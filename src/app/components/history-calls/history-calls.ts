import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { HttpClientModule } from '@angular/common/http';
import { GetHistory, CallHistory, AttendeeSelection } from '../../service/get-history';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-history-calls',
  imports: [CommonModule],
  templateUrl: './history-calls.html',
  styleUrl: './history-calls.scss'
})
export class HistoryCalls implements OnInit {
  private get_history = inject(GetHistory);
  historyUrl: string = `${environment.apiUrl}/rgg/redirect-to-call-history`;

  constructor(
    private cdr: ChangeDetectorRef
  ) {}

  callHistory: CallHistory[] = [];
  attendeeSelection: AttendeeSelection[] = [];
  loading = true;
  error = '';
  downloadingIds: Set<number> = new Set();
  filters = {
    start_date: '',
    end_date: '',
    attended_by: ''
  }

  ngOnInit(): void {
    this.loadCallHistory();
  }

  loadCallHistory(): void {
    this.loading = true;
    this.error = '';

    this.get_history.getCallHistory(this.filters).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.code === 200) {
          this.callHistory = response.data;
          this.attendeeSelection = response.attendee;
          this.cdr.detectChanges();
        } else {
          this.error = response.message || 'Failed to load history';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error fetching data from server';
        console.error('Error fetching call history:', err);
      }
    });
  }

  applyFilters(startDate: string, endDate: string, attendantId: string): void {
    this.filters = {
        start_date: startDate,
        end_date: endDate,
        attended_by: attendantId
    };
    this.loadCallHistory();
  }

  resetFilters(startDateEl: HTMLInputElement, endDateEl: HTMLInputElement, attendantEl: HTMLSelectElement): void {
      // Reset DOM elements
      startDateEl.value = '';
      endDateEl.value = '';
      attendantEl.value = '';
      
      // Reset filters
      this.filters = {
          start_date: '',
          end_date: '',
          attended_by: ''
      };
      this.loadCallHistory();
  }

  printRecord(record: CallHistory): void {
    if (this.downloadingIds.has(record.id)) {
      return;
    }

    this.downloadingIds = new Set(this.downloadingIds).add(record.id);
    this.cdr.detectChanges();

    this.get_history.printCallRecord(record.id).subscribe({
      next: (blob: Blob) => {
        this.downloadingIds = new Set(this.downloadingIds);
        this.downloadingIds.delete(record.id);
        this.cdr.detectChanges();
        
        // For PDF files
        if (blob.type === 'application/pdf') {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${record.name}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        } else {
          console.log('Print action executed successfully');
        }
      },
      error: (err) => {
        this.downloadingIds = new Set(this.downloadingIds);
        this.downloadingIds.delete(record.id);
        this.cdr.detectChanges();
        console.error('Error executing print action:', err);
        alert('Error executing print action. Please try again.');
      }
    });
  }

  refreshData(): void {
    this.loadCallHistory();
  }

  isDownloading(recordId: number): boolean {
    return this.downloadingIds.has(recordId);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
}