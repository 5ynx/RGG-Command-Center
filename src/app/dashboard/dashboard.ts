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
        console.log(response, typeof(response), response.code);
        if (response.code === 200 && response.data) {
          this.test.setCurrentUser(response.data);
          this.currentUser = response.data;
          this.authError = '';
          this.isLoading = false;
          this.showUnauthorized = false;
          
        } else {
          this.authError = response.message || 'Authentication failed';
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.authError = 'Network error during authentication';
        this.isLoading = false;
        this.showUnauthorized = true;
        this.cdr.detectChanges();
        console.error('Auth error:', error);
      }
    });
  }

}
