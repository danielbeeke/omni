export function hashTerm(term) {
  const {
    termType,
    value
  } = term;

  switch (termType) {
    case 'NamedNode':
      return value;

    case 'Literal':
      const {
        language,
        datatype
      } = term;
      return `${termType}|${language}|${datatype.value}|${value}`;

    default:
      return `${termType}|${value}`;
  }
}