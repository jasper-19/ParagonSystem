import { Routes } from '@angular/router';

import { Home } from './features/home/home';
import { ArticlePage } from './features/articles/article'; // ✅ FIXED

import { AdminLayout } from './features/admin/admin-layout';
import { AdminDashboard } from './features/admin/dashboard/admin-dashboard';
import { AllArticlesComponent } from './features/admin/content-management/articles/all-articles/all-articles';

import { EditorialBoard } from './features/editorial-board/editorial-board';

import { SpecialIssues } from './features/special-issues/special-issues';
import { SpecialIssueReader } from './features/special-issues/reader/special-issues-reader';

// add near the top with other imports
import { adminAuthGuard, adminLoginRedirectGuard } from './core/guards/admin-auth.guard';

export const routes: Routes = [
  { path: '', component: Home, data: { breadcrumb: 'Home' } },

  // ✅ Use ArticlePage instead of Article
  { path: 'article/:slug', component: ArticlePage, data: { breadcrumb: 'Article' } },

  {
    path: 'top-stories',
    loadComponent: () =>
      import('./features/categories/categories-page')
        .then(m => m.CategoriesPage),
    data: { breadcrumb: 'Top Stories' }
  },

  {
  path: 'admin/login',
  loadComponent: () =>
    import('./features/admin/login/admin-login').then(m => m.AdminLoginComponent),
  canMatch: [adminLoginRedirectGuard],
  data: { breadcrumb: 'Admin Login' }
},

  {
    path: 'admin',
    component: AdminLayout,
    canMatch: [adminAuthGuard],
    data: { breadcrumb: 'Admin' },
    children: [
      { path: '', loadComponent: () => import('./features/admin/dashboard/admin-dashboard').then(m => m.AdminDashboard), data: { breadcrumb: 'Dashboard' } },
      { path: 'profile', loadComponent: () => import('./features/admin/profile/admin-profile').then(m => m.AdminProfile),data: { breadcrumb: 'Profile' }},
      { path: 'settings',loadComponent: () => import('./features/admin/settings/settings').then(m => m.SettingsComponent),data: { breadcrumb: 'Settings' }},
      { path: 'settings/:tab',loadComponent: () => import('./features/admin/settings/settings').then(m => m.SettingsComponent),data: { breadcrumb: 'Settings' }},

      // Articles Management
      { path: 'all-articles', loadComponent: () => import('./features/admin/content-management/articles/all-articles/all-articles').then(m => m.AllArticlesComponent), data: { breadcrumb: 'All Articles' } },
      { path: 'create-article', loadComponent: () => import('./features/admin/content-management/articles/create-article/create-article').then(m => m.CreateArticleComponent), data: { breadcrumb: 'Create Article' } },
      { path: 'edit-article/:slug', loadComponent: () => import('./features/admin/content-management/articles/create-article/create-article').then(m => m.CreateArticleComponent), data: { breadcrumb: 'Edit Article' } },

      // Special Issues Management
      { path: 'all-special-issues', loadComponent: () => import('./features/admin/content-management/special-issues/all-special-issues/all-special-issues').then(m => m.AllSpecialIssuesComponent), data: { breadcrumb: 'Special Issues' } },
      { path: 'create-special-issue', loadComponent: () => import('./features/admin/content-management/special-issues/create-special-issue/create-special-issue').then(m => m.CreateSpecialIssueComponent), data: { breadcrumb: 'Create Special Issue' } },
      { path: 'edit-special-issue/:slug', loadComponent: () => import('./features/admin/content-management/special-issues/create-special-issue/create-special-issue').then(m => m.CreateSpecialIssueComponent), data: { breadcrumb: 'Edit Special Issue' } },

      // Editorial Board
      { path: 'applications', loadComponent: () => import('./features/admin/editorial-board/applications/applications').then(m => m.ApplicationsComponent), data: { breadcrumb: 'Applications' } },
      { path: 'staff-directory', loadComponent: () => import('./features/admin/editorial-board/staff-directory/staff-directory').then(m => m.StaffDirectoryComponent), data: { breadcrumb: 'Staff Directory' } },
      { path: 'public-board-preview', loadComponent: () => import('./features/admin/editorial-board/public-board-preview/public-board-preview').then(m => m.PublicBoardPreviewComponent), data: { breadcrumb: 'Public Board Preview' } },
    ],
  },

  {
    path: 'special-issues',
    data: { breadcrumb: 'Special Issues' },
    children: [
      { path: '', component: SpecialIssues, data: { breadcrumb: null } },
      { path: ':slug', component: SpecialIssueReader, data: { breadcrumb: 'Read Issue' } },
    ],
  },

  { path: 'editorial-board', component: EditorialBoard, data: { breadcrumb: 'Editorial Board' } },

  {
    path: 'join',
    loadComponent: () => import('./features/join/join').then(m => m.JoinPage),
    },

  { path: '**', redirectTo: '' },


];
