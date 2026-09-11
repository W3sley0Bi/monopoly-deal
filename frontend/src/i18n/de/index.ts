import type { Catalog } from '../types';
import common from './common';
import home from './home';
import table from './table';
import misc from './misc';
import tutorial from './tutorial';
import cards from './cards';
import log from './log';
import errors from './errors';

/** Every string the client shows, merged from one file per area. */
const catalog: Catalog = {
    ...common, ...home, ...table, ...misc, ...tutorial, ...cards, ...log, ...errors,
};

export default catalog;
