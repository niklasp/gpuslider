import { load, pages } from 'virtual:docs';
import { NAME } from '@/components/Frame';
import { mount } from '../mount';
import Docs from './Docs';

// /docs/ is the first page, /docs/<slug>/ the others.
const slug = location.pathname.replace( /^\/docs\/|\/$/g, '' );
const page = pages.find( ( one ) => one.slug === slug ) || pages[ 0 ];
const { default: html } = await load[ page.slug ]();

// The build has written them into the page; the server of `npm run dev`
// has one page for all.
document.title = `${ page.title } · Docs · ${ NAME }`;

mount( <Docs slug={ page.slug } html={ html } /> );
