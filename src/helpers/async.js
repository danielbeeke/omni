'use strict';
import umap from 'umap';

const {isArray} = Array;

const sync = (values, i) => {
  const resolved = [];
  for (const {length} = values; i < length; i++)
    resolved.push(isArray(values[i]) ? sync(values[i], 0) : values[i]);
  return Promise.all(resolved);
};

/**
 * Returns a template literal tag abe to resolve, recursively, any possible
 * asynchronous interpolation.
 * @param {function} tag a template literal tag.
 * @returns {function} a template literal tag that resolves interpolations
 *                     before passing these to the initial template literal.
 */
const asyncTag = tag => {
  function invoke(template, values) {
    const unproxiedValues = values.map(item => {
      return item?.proxy ? item.toString() : item
    }).filter(Boolean)
    return tag.apply(this, [template].concat(unproxiedValues));
  }
  return function (template) {
    return sync(arguments, 1).then(invoke.bind(this, template));
  };
};


import {render as $render, html as $html, svg as $svg} from 'uhtml';

const {defineProperties} = Object;

const tag = original => {
  const wrap = umap(new WeakMap);
  return defineProperties(
    asyncTag(original),
    {
      for: {
        value(ref, id) {
          const tag = original.for(ref, id);
          return wrap.get(tag) || wrap.set(tag, asyncTag(tag));
        }
      },
      node: {
        value: asyncTag(original.node)
      }
    }
  );
};

export const html = tag($html);
export const svg = tag($svg);

export const render = (where, what) => {
  const hole = typeof what === 'function' ? what() : what;
  return Promise.resolve(hole).then(what => $render(where, what));
};