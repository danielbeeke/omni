/**
 * Returns a function that creates a new path with the same values,
 * but sorted on the given property.
 * The function accepts multiple properties to sort on a deeper path.
 *
 * Requires:
 *  - a predicate on the path proxy
 *  - a sort function on the path proxy (for multi-property sorting)
 */
export default class GetCache {

  constructor (context) {
    this.context = context
  }

  handle(pathData, pathProxy) {
    return {
      property: pathData.propertyCache,
      results: pathData.resultCache,
      context: this.context
    }
  }
}
