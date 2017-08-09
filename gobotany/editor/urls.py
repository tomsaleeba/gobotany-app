from django.conf.urls import url
from django.views.generic import RedirectView

from . import views

urlpatterns = [
    url(r'^cv/$', views.piles_view),
    url(r'^cv/([^/]+)-characters/$', views.pile_characters),
    url(r'^cv/([^/]+)-characters/([^/]+)/$', views.edit_pile_character),
    url(r'^cv/([^/]+)-taxa/$', views.pile_taxa),
    url(r'^cv/([^/]+)-taxa/([^/]+)/$', views.edit_pile_taxon),
    url(r'^cv/lit-sources/([.0-9]+)/$', views.edit_lit_sources),
    url(r'^partner/(\d+)/plants/$', views.partner_plants),
    url(r'^partner/(\d+)/plants/upload/$', views.partner_plants_upload),
    url(r'^partner(\d+)-plants.csv$', views.partner_plants_csv),
    url(r'^dkey/$', views.dkey),
    url(r'^dkey/(?P<slug>[^/]*)/$', views.dkey),
    url(r'^species/(?P<genus>[^/]*)/(?P<specific_epithet>[^/]*)/$',
        views.dkey_species),
    url(r'^.*', views.e404),  # prevent fall-through to wildcard rewrite URL
]
