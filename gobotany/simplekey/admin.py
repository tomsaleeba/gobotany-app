from django.contrib import admin

from gobotany.simplekey.models import Video, HelpPage

class VideosInline(admin.TabularInline):
    model = HelpPage.videos.through
    extra = 0

class HelpPageAdmin(admin.ModelAdmin):
    exclude = ('videos',)
    inlines = (VideosInline,)

admin.site.register(HelpPage, HelpPageAdmin)
admin.site.register(Video)
