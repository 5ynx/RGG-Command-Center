import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';

export const routes: Routes = [
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: Dashboard },
    
    // Optional: Add a wildcard route for 404 pages
    // { path: '**', redirectTo: '/dashboard' }
];
