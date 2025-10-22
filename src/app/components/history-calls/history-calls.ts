import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { HttpClientModule } from '@angular/common/http';
import { GetHistory, CallHistory, AttendeeSelection } from '../../service/get-history';
import { environment } from '../../../environments/environment';
import { CallService } from '../../service/call.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-history-calls',
  imports: [CommonModule, FormsModule],
  templateUrl: './history-calls.html',
  styleUrl: './history-calls.scss'
})
export class HistoryCalls implements OnInit {
  private get_history = inject(GetHistory);
  historyUrl: string = `${environment.apiUrl}/rgg/redirect-to-call-history`;

  constructor(
    private cdr: ChangeDetectorRef,
    private callService: CallService
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

  applyFilters(attendantId: string): void {
    this.filters = {
        start_date: this.startHiddenDateValue,
        end_date: this.endHiddenDateValue,
        attended_by: attendantId
    };
    this.loadCallHistory();
  }

  resetFilters(attendantEl: HTMLSelectElement): void {
      // Reset DOM elements
      this.startDateValue = '';
      this.startHiddenDateValue = ''

      this.endDateValue = '';
      this.endHiddenDateValue = ''

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

  startDateValue = ''
  startHiddenDateValue = ''

  endDateValue = ''
  endHiddenDateValue = ''

  onDisplayInputClick(id: string, input_id: string) {
    console.log(id, input_id)
    const dateInput = document.getElementById(id) as HTMLInputElement;
    const startInput = document.getElementById(input_id) as HTMLElement;
    console.log(dateInput, startInput)
    setTimeout(() => {

      if (dateInput) {
        const rect = startInput.getBoundingClientRect();

        // Tempatkan date input tepat di samping (kanan) input utama
        dateInput.style.position = 'fixed';
        dateInput.style.top = `${rect.top}px`;
        dateInput.style.left = `${rect.right + 5}px`; // 5px jarak di kanan
        dateInput.style.width = '150px';
        dateInput.style.height = 'auto';
        dateInput.style.opacity = '0.01';
        dateInput.style.pointerEvents = 'auto';
        dateInput.style.zIndex = '9999';

        try {
          dateInput.focus();
          dateInput.showPicker();
        } catch {
          dateInput.click();
        }

        // Setelah picker dibuka, kembalikan ke posisi tersembunyi
        setTimeout(() => {
          dateInput.style.position = 'absolute';
          dateInput.style.left = '-9999px';
          dateInput.style.opacity = '0';
          dateInput.style.pointerEvents = 'none';
        }, 500);

      }
    }, 100); // Delay lebih lama untuk iOS
  }

  onDateInputChange(is_start: boolean) {
    if (is_start) {
      if (this.startHiddenDateValue) {
        const date = new Date(this.startHiddenDateValue);
        this.startDateValue = this.formatDateForDisplay(date);
      } else {
        this.startDateValue = ''
      }
    } else {
      if (this.endHiddenDateValue) {
        const date = new Date(this.endHiddenDateValue);
        this.endDateValue = this.formatDateForDisplay(date);
      } else {
        this.endDateValue = ''
      }
    }
  }

  formatDateForDisplay(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }


}
