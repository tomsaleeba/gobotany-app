from django.contrib.auth.decorators import login_required
from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render, render_to_response
from django.template import RequestContext

from gobotany.plantshare.forms import NewSightingForm
from gobotany.plantshare.models import Location, Sighting

def _new_sighting_form_page(request, form):
    """Give a new-sighting form, either blank or with as-yet-invalid data."""
    return render(request, 'new_sighting.html', {
               'form': form,
           }, context_instance=RequestContext(request))

# Views

def plantshare_view(request):
    """View for the main PlantShare page."""
    return render_to_response('plantshare.html', {
           }, context_instance=RequestContext(request))

def sightings_view(request):
    """View for the sightings collection, and handling new sightings."""
    if request.method == 'POST':
        # Handle posting a new sighting to the sightings collection.
        # TODO: require login for just this HTTP verb.
        form = NewSightingForm(request.POST)
        if form.is_valid():
            location = Location(user_input=form.cleaned_data['location'])
            location.save()

            identification = form.cleaned_data['identification']
            title = form.cleaned_data['title']
            notes = form.cleaned_data['notes']
            location_notes = form.cleaned_data['location_notes']
            sighting = Sighting(user=request.user,
                                identification=identification, title=title,
                                notes=notes, location=location,
                                location_notes=location_notes)
            sighting.save()
            #print 'saved:', sighting

            done_url = reverse('ps-new-sighting-done') + '?s=%d' % sighting.id
            return HttpResponseRedirect(done_url)
        else:
            # Present the new-sighting form again for input correction.
            return _new_sighting_form_page(request, form)
    elif request.method == 'GET':
        # Return a representation of the collection of sightings.
        sightings = Sighting.objects.all()[:20]  # some latest sightings
        return render_to_response('sightings.html', {
                'sightings': sightings,
               }, context_instance=RequestContext(request))
    else:
        # For an unsupported HTTP method, return a Bad Request response.
        return HttpResponse(status=400)

def sighting_view(request, sighting_id):
    """View for an individual sighting."""
    sighting = Sighting.objects.get(id=sighting_id)
    return render_to_response('sighting.html', {
               'sighting': sighting,
           }, context_instance=RequestContext(request))

@login_required
def new_sighting_view(request):
    """View for a blank form for posting a new sighting."""
    form = NewSightingForm()
    return _new_sighting_form_page(request, form)

@login_required
def new_sighting_done_view(request):
    """View for a confirmation page upon posting a new sighting."""
    return render_to_response('new_sighting_done.html', {
           }, context_instance=RequestContext(request))

@login_required
def profile_view(request):
    """View for the logged-in user's profile."""
    return render_to_response('profile.html', {
           }, context_instance=RequestContext(request))
