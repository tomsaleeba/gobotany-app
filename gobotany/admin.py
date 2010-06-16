from django.contrib import admin
from django.contrib.contenttypes import generic
from django.core.exceptions import ObjectDoesNotExist
from django import forms
from gobotany import models


class ContentImageInline(generic.GenericStackedInline):
    model = models.ContentImage
    extra = 1

class TaxonAdminForm(forms.ModelForm):
    class Meta:
        model = models.Taxon

    def clean_character_values(self):
        """Validate that the selected character values are allowed in
        the Taxon's pile"""
        pile = self.cleaned_data['pile']
        for cv in self.cleaned_data['character_values']:
            try:
                cv.pile_set.get(id=pile.id)
            except ObjectDoesNotExist:
                raise forms.ValidationError(
                    'The value %s is not allowed for Pile %s'%(cv, pile.name))
        return self.cleaned_data['character_values']

class TaxonAdmin(admin.ModelAdmin):
    inlines = [ContentImageInline]
    form = TaxonAdminForm
    filter_vertical = ('character_values',)
    list_filter = ('pile',)

admin.site.register(models.Taxon, TaxonAdmin)


class GlossaryMappingInline(admin.TabularInline):
    model = models.GlossaryTermForPileCharacter
    extra = 1

class CharacterAdmin(admin.ModelAdmin):
    inlines=[GlossaryMappingInline]

admin.site.register(models.Character, CharacterAdmin)

admin.site.register(models.ContentImage)
admin.site.register(models.ImageType)
admin.site.register(models.Pile)
admin.site.register(models.GlossaryTerm)
admin.site.register(models.CharacterGroup)
admin.site.register(models.CharacterValue)
