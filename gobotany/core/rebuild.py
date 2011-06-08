"""Rebuild parts of our database that we generate rather than import."""

import csv
import re
import sys
import time

from itertools import chain
from StringIO import StringIO

from django.core import management
from django.core.exceptions import ObjectDoesNotExist

from gobotany import settings
management.setup_environ(settings)
from gobotany.core import igdt, importer, models


class CSVReader(object):

    def __init__(self, filename):
        self.filename = filename

    def read(self):
        # Open in universal newline mode in order to deal with newlines in
        # CSV files saved on Mac OS.
        with open(self.filename, 'rU') as f:
            r = csv.reader(f, dialect=csv.excel, delimiter=',')
            for row in r:
                yield [c.decode('Windows-1252') for c in row]


def _get_default_filters_from_csv(pile_name, characters_csv):
    iterator = iter(CSVReader(characters_csv).read())
    colnames = [x.lower() for x in iterator.next()]
    filters = []
    for cols in iterator:
        row = dict(zip(colnames, cols))

        if row['pile'].lower() == pile_name.lower():
            if row['default_question'] != '':
                character_name = row['character']
                order = row['default_question']

                im = importer.Importer(StringIO())
                short_name = im.character_short_name(character_name)

                filters.append((order, short_name))

    default_filter_characters = []
    filters.sort()
    for f in filters:
        character_name = f[1]
        try:
            character = models.Character.objects.get( \
                short_name=character_name)
            default_filter_characters.append(character)
        except models.Character.DoesNotExist:
            print "Error: Character does not exist: %s" % character_name
            continue

    return default_filter_characters


def _add_best_filters(pile, common_filter_character_names):
    print "  Computing new 'best' filters"
    t = time.time()
    result = igdt.rank_characters(pile, list(pile.species.all()))
    print "  Computation took %.3f seconds" % (time.time() - t)

    print "  Inserting new 'best' filters:"
    DEFAULT_BEST_FILTERS_PER_PILE = 3
    number_of_filters_to_evaluate = DEFAULT_BEST_FILTERS_PER_PILE + \
        len(common_filter_character_names)
    result = result[:number_of_filters_to_evaluate]
    number_added = 0
    for n, (score, entropy, coverage, character) in enumerate(result):
        # Skip any 'common' filters if they come up in the 'best' filters,
        # because they've already been added.
        if (character.short_name not in common_filter_character_names):
            print "   ", character.name
            defaultfilter = models.DefaultFilter()
            defaultfilter.pile = pile
            defaultfilter.character = character
            defaultfilter.order = n + len(common_filter_character_names)
            defaultfilter.save()
            number_added += 1
            # If no more filters need to be added, stop now.
            if number_added == DEFAULT_BEST_FILTERS_PER_PILE:
                break


def rebuild_default_filters(characters_csv):
    """Rebuild default filters for every pile, using CSV data where
       available or choosing 'best' characters otherwise.
    """
    for pile in models.Pile.objects.all():
        print "Pile", pile.name

        old_filters = pile.default_filters.all()
        print "  Clearing %d old default filters" % len(old_filters)
        # Just clear the old filters rather than deleting them, so as to not
        # have a delete-cascade that also deletes character records.
        pile.default_filters.clear()

        COMMON_FILTER_CHARACTER_NAMES = ['habitat', 'state_distribution']
        print "  Inserting common filters:"
        for n, character_name in enumerate(COMMON_FILTER_CHARACTER_NAMES):
            try:
                character = models.Character.objects.get( \
                    short_name=character_name)
            except models.Character.DoesNotExist:
                print "Error: Character does not exist: %s" % character_name
                continue
            print "   ", character.name
            defaultfilter = models.DefaultFilter()
            defaultfilter.pile = pile
            defaultfilter.character = character
            defaultfilter.order = n
            defaultfilter.save()

        # Look for default filters specified in the CSV data. If not found,
        # add some next 'best' filters instead.
        default_filter_characters = _get_default_filters_from_csv(pile.name,
            characters_csv)
        if len(default_filter_characters) > 0:
            print "  Inserting new default filters from CSV data:"
            for n, character in enumerate(default_filter_characters):
                print "   ", character.name
                defaultfilter = models.DefaultFilter()
                defaultfilter.pile = pile
                defaultfilter.character = character
                defaultfilter.order = n + len(COMMON_FILTER_CHARACTER_NAMES)
                defaultfilter.save()
        else:
            _add_best_filters(pile, COMMON_FILTER_CHARACTER_NAMES)


def _remove_sample_pile_images():
    """Remove any sample species images from each pile group and pile."""
    print '  Removing old images:'
    for p in chain(models.PileGroup.objects.all(), models.Pile.objects.all()):
        print '    ', (type(p).__name__ + ': ' + p.name),
        old_images = p.sample_species_images.all()
        if len(old_images):
            print '      removing %d old images' % len(old_images)
            for image in old_images:
                p.sample_species_images.remove(image)
        else:
            print '      none'


def _extend_image_list(image_list, pile):
    """For each species in a pile, extend an image list with all images."""
    for species in pile.species.all():
        image_list.extend(list(species.images.all()))
    return image_list


def _add_sample_species_image(image_instance, pile_or_group):
    """Add a sample species image to a pile group or pile. In the case of a
       pile, also add a sample species image to that pile's pile group, being
       careful not to add any duplicates.
    """
    p = pile_or_group
    p.sample_species_images.add(image_instance)
    message = 'added'

    try:
        if p.pilegroup:
            # See whether this image has already been added to the pile group.
            image_found = False
            for existing_instance in p.pilegroup.sample_species_images.all():
                if existing_instance.image.name == image_instance.image.name:
                    image_found = True
                    break
            if not image_found:
                p.pilegroup.sample_species_images.add(image_instance)
                message += ', and added to pile group ' + p.pilegroup.name
    except AttributeError:
        pass
    finally:
        return message


def rebuild_sample_pile_images(pile_or_group_csv_1, pile_or_group_csv_2):
    """Assign sample species images to each pile group and pile."""
    print 'Rebuild sample pile images:'

    _remove_sample_pile_images()

    print '  Adding images from CSV data:'
    files = [pile_or_group_csv_1, pile_or_group_csv_2]
    for f in files:
        iterator = iter(CSVReader(f).read())
        colnames = [x.lower() for x in iterator.next()]

        for cols in iterator:
            row = dict(zip(colnames, cols))
            # Skip junk rows.
            if row['name'].lower() == 'all' or \
               row['name'].lower() == 'unused':
                continue

            # Build a list of all species images in the pile or pile group.
            image_list = []
            try:
                # First check whether this row is a pile group.
                p = models.PileGroup.objects.get(name=row['name'])
                print '    PileGroup:', p.name
                # If so, extend the image list with the list of all species
                # images for all piles in the group.
                for pile in p.piles.all():
                    _extend_image_list(image_list, pile)
            except ObjectDoesNotExist:
                # If this row is not a pile group, it must be a pile.
                p = models.Pile.objects.get(name=row['name'].title())
                print '    Pile:', p.name
                # Extend the image list with the list of all species images
                # for the pile.
                _extend_image_list(image_list, p)

            # Go through the image filenames specified in the CSV data and
            # look for them in the image list. If found, add them to the
            # pile or pile group as a sample species image. For piles, also
            # add any images to that pile's pile groups, if present.
            image_filenames = row['image_filenames'].split(';')
            for filename in image_filenames:
                # Skip malformed filenames.
                if not filename.lower().endswith('.jpg'):
                    continue
                print '      filename:', filename,
                found = False
                message = ''
                for image_instance in image_list:
                    if image_instance.image.name.find(filename) > -1:
                        message = _add_sample_species_image(image_instance, p)
                        found = True
                        break
                if found:
                    print '- found, ' + message
                else:
                    print '- not found'


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print >>sys.stderr, "Usage: rebuild THING {args}"
        exit(2)
    thing = sys.argv[1]
    function_name = 'rebuild_' + thing
    if function_name in globals():
        function = globals()[function_name]
        function(*sys.argv[2:])
    else:
        print >>sys.stderr, "Error: rebuild target %r unknown" % thing
        exit(2)
