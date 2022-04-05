import { SparqlHandler } from "ldflex";

export class SparqlHandlerGraph extends SparqlHandler {

  pathExpressionToQuery(pathData, path, pathExpression) {
    // if (pathExpression.length < 2 && !pathData.finalClause) throw new Error(`${pathData} should at least contain a subject and a predicate`); // Create triple patterns

    let queryVar = '?subject',
        sorts = [],
        clauses = [];

    if (pathExpression.length > 1) {
      queryVar = this.createVar(pathData.property);
      ({
        queryVar,
        sorts,
        clauses
      } = this.expressionToTriplePatterns(pathExpression, queryVar));
    }

    if (pathData.finalClause) clauses.push(pathData.finalClause(queryVar)); // Create SPARQL query body

    const distinct = pathData.distinct ? 'DISTINCT ' : '';
    const select = `SELECT ${distinct}${pathData.select ? pathData.select : queryVar}`;
    const where = ` WHERE {\n  ${clauses.join('\n  ')}\n}`;
    const orderClauses = sorts.map(_ref => {
      let {
        order,
        variable
      } = _ref;
      return `${order}(${variable})`;
    });
    const orderBy = orderClauses.length === 0 ? '' : `\nORDER BY ${orderClauses.join(' ')}`;
    return `${select} FROM <urn:x-arq:UnionGraph> ${where}${orderBy}`;
  }

}