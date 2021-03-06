"""Report on the differences between two data sets."""

nil = object()  # need another object
end = object()  # end-of-iteration marker
endpair = (end, end)


def _keys_and_items(sequence, indices):
    """Yield ``(key, item)`` pairs where the key is built from `indices`.

    See the description of `pairs()` for how `indices` work.

    """
    for item in sequence:
        key = map(item.__getitem__, indices)
        yield key, item


def pairs(sequence1, sequence2, indices):
    """Yield matched and unmatched items from two sequences.

    Both `sequence1` and `sequence2` should already by sorted by
    `indices`.

    For each item in the sequences, a key will be generated by pulling
    the given `indices` from the item.  If your sequence items are lists
    or tuples, `indices` might look like ``[1]`` or ``[0,2]``, whereas
    items that are dictionaries will have indices like ``['state',
    'county']``.

    This generator yields a succession of 2-element tuples:

    ``(item1, item2)`` - for items whose key matches.
    ``(item1, None)`` - an item in `sequence1` with no match in `sequence2`.
    ``(None, item2)`` - an item in `sequence2` with no match in `sequence1`.

    """
    iter1 = _keys_and_items(sequence1, indices)
    iter2 = _keys_and_items(sequence2, indices)
    key1, item1 = next(iter1, endpair)
    key2, item2 = next(iter2, endpair)

    while (item1 is not end) and (item2 is not end):
        if key1 == key2:
            yield (item1, item2)
            key1, item1 = next(iter1, endpair)
            key2, item2 = next(iter2, endpair)
        elif key1 < key2:
            yield (item1, None)
            key1, item1 = next(iter1, endpair)
        else:
            yield (None, item2)
            key2, item2 = next(iter2, endpair)

    while item1 is not end:
        yield (item1, None)
        key1, item1 = next(iter1)
    while item2 is not end:
        yield (None, item2)
        key2, item2 = next(iter2)


class DifferenceEngine(object):

    def __init__(self):
        self.inserts = []
        self.updates = []
        self.deletes = []

    def differentiate(self, have, want, indices):
        for h, w in pairs(have, want, indices):
            if h is None:
                self.inserts.append(w)
            elif w is None:
                self.deletes.append(h)
            elif h != w:
                self.updates.append((h, w))
