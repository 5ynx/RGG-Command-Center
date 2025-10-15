import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MissedCalls } from "../components/missed-calls/missed-calls";
import { IncomingCalls } from "../components/incoming-calls/incoming-calls";
import { VideoCalls } from "../components/video-calls/video-calls";
import { HistoryCalls } from "../components/history-calls/history-calls";
import { Test, User } from "../service/test";
import { ActivatedRoute, Router } from "@angular/router";

@Component({
  selector: 'app-dashboard',
  imports: [MissedCalls, IncomingCalls, VideoCalls, HistoryCalls],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  isLoading = true;
  authError = '';
  currentUser: User | null = null;
  showUnauthorized = false;

  constructor(
    private test: Test,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    setTimeout(() => {
      if (this.test.isAuthenticated()) {
        this.currentUser = this.test.getCurrentUserSync();
        this.isLoading = false;
        this.showUnauthorized = false;
        this.clearUrlParameters();
        this.cdr.detectChanges();
        return;
      }

      const { userId, token } = this.test.getAuthParamsFromUrl();
      
      if (!userId || !token) {
        this.authError = 'Missing authentication parameters';
        this.isLoading = false;
        this.showUnauthorized = true;
        this.cdr.detectChanges();
        return;
      }
      
      this.test.validateToken(userId, token).subscribe({
        next: (response) => {
          if (response.code === 200 && response.data) {
            this.test.setCurrentUser(response.data);
            this.currentUser = response.data;
            this.authError = '';
            this.isLoading = false;
            this.showUnauthorized = false;
            this.clearUrlParameters();
            
          } else {
            this.authError = response.message || 'Authentication failed';
            this.isLoading = false;
            this.showUnauthorized = true;
            this.test.clearStorage();
          }
          
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.authError = 'Network error during authentication';
          this.isLoading = false;
          this.showUnauthorized = true;
          this.test.clearStorage(); 
          this.cdr.detectChanges();
          console.error('Auth error:', error);
        }
      });
    }, 100);
  }

  private clearUrlParameters(): void {
    try {
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
      console.log('URL parameters cleared using history.replaceState');
      
    } catch (error) {
      console.error('Error clearing URL parameters:', error);
    }
  }

  // Optional: Add logout method
  // logout(): void {
  //   this.test.clearStorage();
  //   this.currentUser = null;
  //   this.showUnauthorized = true;
  //   this.cdr.detectChanges();
  // }
}