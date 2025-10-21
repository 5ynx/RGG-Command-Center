import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

export interface User {
  user_id: number;
  name: string;
}

export interface AuthResponse {
  code: number;
  message: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class Test {
  private apiUrl = `${environment.apiUrl}/rgg-dashboard/validate-token`;
  private currentUser = new BehaviorSubject<User | null>(null);
  private readonly STORAGE_KEY = 'rgg_dashboard_auth';
  private isBrowser: boolean;
  private storageInitialized = false;

  constructor(
    protected http: HttpClient,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.initializeStorage();
  }

  private initializeStorage(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        const storedUser = this.getStoredUser();
        console.log("check heree -->", storedUser)
        this.currentUser.next(storedUser);
        this.storageInitialized = true;
      });
    }
  }

  getAuthParamsFromUrl(): { userId: string | null, token: string | null} {
    const params = this.route.snapshot.queryParams;
    return {
      userId: params['user_id'],
      token: params['access_token'],
    };
  }

  validateToken(userId: string, token: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.apiUrl, {
      user_id: userId,
      access_token: token
    });
  }

  setCurrentUser(user: User): void {
    this.currentUser.next(user);
    if (this.isBrowser) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        user: user,
        timestamp: Date.now()
      }));
    }
  }
  
  getCurrentUserSync(): User | null {
    return this.currentUser.value;
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  isAuthenticated(): boolean {
    return this.currentUser.value !== null;
  }

  private getStoredUser(): User | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      
      if (!stored) {
        return null;
      }

      const authData = JSON.parse(stored);
      
      if (!authData.user || !authData.timestamp) {
        this.clearStorage();
        return null;
      }

      const timestamp = authData.timestamp;
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - timestamp > twentyFourHours) {
        this.clearStorage();
        return null;
      }

      return authData.user;

    } catch (error) {
      this.clearStorage();
      return null;
    }
  }

  getStoredUserPublic(){
    if (!this.isBrowser) {
      return null;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      
      if (!stored) {
        return null;
      }

      const authData = JSON.parse(stored);
      
      if (!authData.user || !authData.timestamp) {
        this.clearStorage();
        return null;
      }

      const timestamp = authData.timestamp;
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - timestamp > twentyFourHours) {
        this.clearStorage();
        return null;
      }

      return authData.user;

    } catch (error) {
      this.clearStorage();
      return null;
    }
  }

  clearStorage(): void {
    if (this.isBrowser) {
      localStorage.removeItem(this.STORAGE_KEY);
    }
    this.currentUser.next(null);
  }

  clearUrlParameters(router: any): void {
    const urlTree = router.createUrlTree([], {
      queryParams: {},
      queryParamsHandling: 'merge',
    });
    router.navigateByUrl(urlTree);
  }
}