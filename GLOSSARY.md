# Catalog

The sample business area: the products on offer and the lifecycle that decides which of them can be
sold.

## Language

### Products

**Product**:
Something offered for sale, with a name and, once decided, a price.
_Avoid_: Item, article, SKU

**Publication**:
The recorded fact that a product was published, and when; a product has at most one.
_Avoid_: Release, publish event

### Lifecycle

**Draft**:
The state a product starts in: not yet on offer, and allowed to have no price.
_Avoid_: New, pending, unpublished

**Published**:
The state of a product that is on offer; only a draft with a price can be published.
_Avoid_: Live, active, released

**Retired**:
The final state of a product taken off offer after being published; it stays on record.
_Avoid_: Deleted, archived, discontinued
