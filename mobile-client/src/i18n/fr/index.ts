import invite from './invite';
import type { Catalog } from '../types';
import common from './common';
import home from './home';
import table from './table';
import misc from './misc';
import tutorial from './tutorial';
import cards from './cards';
import log from './log';
import errors from './errors';
import gif from './gif';
import audio from './audio';

/** French: every string the client shows, merged from one file per area. */
const catalog: Catalog = {
    ...invite,
    ...common,
    ...home,
    ...table,
    ...misc,
    ...tutorial,
    ...cards,
    ...log,
    ...errors,
    ...gif,
    ...audio,
};

export default catalog;
