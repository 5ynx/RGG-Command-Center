import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

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
  constructor(
    protected http: HttpClient,
    private route: ActivatedRoute,
  ) {
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
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  isAuthenticated(): boolean {
    return this.currentUser.value !== null;
  }

}
