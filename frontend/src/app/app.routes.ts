import { Routes } from '@angular/router';

// prettier-ignore
export const routes: Routes = [
  {
    path: '',
    title: $localize`:@@route.home.title:Home`,
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  { path: 'catalog', title: $localize`:@@route.catalog.title:Catalog`, loadComponent: () => import('./catalog/product-list/product-list').then((m) => m.ProductList) }, // sample:catalog
  { path: 'catalog/new', title: $localize`:@@route.catalogNew.title:New product`, loadComponent: () => import('./catalog/product-form/product-form').then((m) => m.ProductForm) }, // sample:catalog
  {
    path: '**',
    title: $localize`:@@route.notFound.title:Not found`,
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
