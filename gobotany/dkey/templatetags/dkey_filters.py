# -*- coding: utf-8 -*-

"""Compute the display title of a Couplet."""

import re
from django.template import Context, Library
from django.template.loader import get_template
from django.utils.safestring import SafeUnicode, mark_safe
from gobotany.dkey import models
from gobotany.dkey.views import group_texts

register = Library()

plurals = {
    'family': 'families',
    'genus': 'genera',
    'species': 'species',
    'tribe': 'tribes',
    }

@register.filter
def abbreviate_title(s):
    """Make 'Acer rubrum' 'A. rubrum' and remove 'Group' from group titles."""
    if u'Group ' in s:
        return s.replace(u'Group ', u'')
    else:
        parts = s.split(None, 1)
        if len(parts) < 2:
            return s
        genus, rest = s.split(None, 1)
        return u'%s. %s' % (genus[0], rest)

@register.filter
def breadcrumbs(page):
    return page.breadcrumb_cache.order_by('id')

@register.filter
def breadcrumb_title(page):
    if page.rank == 'group':
        number = int(page.title.split()[-1])  # 'Group 4' -> 4
        return u'{}: {}'.format(display_title(page), group_texts[number])
    else:
        return display_title(page)

@register.filter
def display_title(page):
    if page.rank == 'family':
        return u'Family {}'.format(page.title)
    elif page.rank == 'genus' or page.rank == 'species':
        return mark_safe(u'<i>{}</i>'.format(page.title))
    else:
        return page.title

@register.filter
def dkey_url(name):
    name = name.lower()
    if ' ' in name:
        return '/species/' + name.replace(' ', '/') + '/?key=dichotomous';
    else:
        return '/dkey/' + name + '/';

@register.filter
def figure_url(figure):
    return 'http://newfs.s3.amazonaws.com/dkey-figures/figure-{}.png'.format(
        figure.number)

@register.filter
def genus_slug(page_title):
    return page_title.split()[0].lower()

re_floating_figure = re.compile(ur'<FIG-(\d+)>')  # see parser.py
re_figure_mention = re.compile(ur'\[Figs?\. ([\d, ]+)\]')

@register.filter
def render_floating_figure(match):
    number = int(match.group(1))
    figure = models.Figure.objects.get(number=number)
    return get_template('dkey/figure.html').render(Context({'figure': figure}))

@register.filter
def render_figure_mention(match):
    numbers = [ int(number) for number in match.group(1).split(',') ]
    figures = list(models.Figure.objects.filter(number__in=numbers))
    context = Context({'figures': figures})
    return get_template('dkey/figure_mention.html').render(context)

@register.filter
def figurize(text):
    text = re_floating_figure.sub(render_floating_figure, text)
    text = re_figure_mention.sub(render_figure_mention, text)
    return text

@register.filter
def lastword(text):
    return text.split()[-1]

@register.filter
def nobr(text):
    new = text.replace(u' ', u'\u00a0')
    return mark_safe(new) if isinstance(text, SafeUnicode) else new

@register.filter
def slug(page, chars=None):
    return page.title.lower().replace(u' ', u'-')

@register.filter
def species_slug(page_title):
    return page_title.split()[1].lower()

@register.filter
def taxon_plural(s):
    return plurals[s]
