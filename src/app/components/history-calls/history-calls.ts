import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GetHistory, CallHistory, AttendeeSelection } from '../../service/get-history';
import { environment } from '../../../environments/environment';
import { CallService } from '../../service/call.service';
import { FormsModule } from '@angular/forms';
import { UrlApiService } from '../../service/url-api/url-api.service';

@Component({
  selector: 'app-history-calls',
  imports: [CommonModule, FormsModule],
  templateUrl: './history-calls.html',
  styleUrl: './history-calls.scss'
})
export class HistoryCalls implements OnInit, OnDestroy {
  private get_history = inject(GetHistory);
  historyUrl: string = `${environment.apiUrl}/rgg/redirect-to-call-history`;

  constructor(
    private cdr: ChangeDetectorRef,
    private callService: CallService,
    private ApiUrl: UrlApiService
  ) {}

  callHistory: CallHistory[] = [];
  attendeeSelection: AttendeeSelection[] = [];
  loading = true;
  error = '';
  downloadingIds: Set<number> = new Set();
  filters = {
    start_date: '',
    end_date: '',
    project_id: '',
    attended_by: ''
  }

  // Project Selection Variables
  FilteredProjects: any = []
  Projects: any = []
  selectedProject: any = false
  search_project: any = ''
  is_project_search_focus = false

  // Call Attended Selection Variables
  FilteredAttendees: any = []
  Attendees: any = []
  selectedAttendee: any = false
  search_attendee: any = ''
  is_attendee_search_focus = false

  errMessage = ''

  @ViewChild('searchInput') searchComponent!: ElementRef;
  @ViewChild('selectionInput') selectionComponent!: ElementRef;
  @ViewChild('attendeeSearchInput') attendeeSearchComponent!: ElementRef;
  @ViewChild('attendeeSelectionInput') attendeeSelectionComponent!: ElementRef;

  ngOnInit(): void {
    this.loadCallHistory();
    this.loadProjects();
    
    // Register click outside listener
    document.addEventListener('click', this.handleClickOutside);
  }

  ngOnDestroy(): void {
    // Cleanup event listener
    document.removeEventListener('click', this.handleClickOutside);
  }

  handleClickOutside = (event: MouseEvent) => {
    // Check Project dropdown
    if (this.selectionComponent && this.searchComponent) {
      const selectionClicked = this.selectionComponent.nativeElement.contains(event.target);
      const searchClicked = this.searchComponent.nativeElement.contains(event.target);
      if (!searchClicked && !selectionClicked) {
        this.is_project_search_focus = false;
        this.cdr.detectChanges();
      }
    }

    // Check Attendee dropdown
    if (this.attendeeSelectionComponent && this.attendeeSearchComponent) {
      const attendeeSelectionClicked = this.attendeeSelectionComponent.nativeElement.contains(event.target);
      const attendeeSearchClicked = this.attendeeSearchComponent.nativeElement.contains(event.target);
      if (!attendeeSearchClicked && !attendeeSelectionClicked) {
        this.is_attendee_search_focus = false;
        this.cdr.detectChanges();
      }
    }
  };

  // ========== PROJECT METHODS ==========
  loadProjects() {
    this.loading = true
    this.ApiUrl.urlApi('/rgg/get-project', {}).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.code === 200) {
          this.Projects = response.result;
          this.FilteredProjects = this.Projects
          this.loadAttendees();
          this.cdr.detectChanges();
        } else {
          this.errMessage = response.message || 'Failed to load project';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errMessage = 'Error fetching data from server';
        console.error('Error fetching load project:', err);
      }
    });
  }

  searchProject(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if ((event.key === 'Backspace' && !this.search_project && this.selectedProject)) {
      this.selectProject(this.selectedProject)
    }  
    this.search_project = input.value || ''
    this.is_project_search_focus = true
    this.FilteredProjects = this.Projects.filter((item: any) => 
      item.name.toLowerCase().includes(this.search_project.toLowerCase())
    )
  }

  selectProject(project: any) {
    if (project.id == this.selectedProject.id) {
      this.selectedProject = false
    } else {
      this.selectedProject = project
      this.search_project = ''
      this.searchComponent.nativeElement.value = ''
    }
    this.cdr.detectChanges()
    this.is_project_search_focus = false
  }

  searchProjectFocus(is_focus: boolean = true) {
    this.is_project_search_focus = is_focus
    this.FilteredProjects = this.Projects
  }

  getProjectCheckValue(project_id: number) {
    return this.selectedProject ? (project_id == this.selectedProject.id) : false
  }

  projectCheckboxKeyed(event: KeyboardEvent, project: any) {
    if (event.key === 'Enter') {
      this.selectProject(project)
    }
  }

  // ========== ATTENDEE METHODS ==========
  loadAttendees() {
    this.Attendees = this.attendeeSelection;
    this.FilteredAttendees = this.Attendees
    this.cdr.detectChanges();
  }

  searchAttendee(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if ((event.key === 'Backspace' && !this.search_attendee && this.selectedAttendee)) {
      this.selectAttendee(this.selectedAttendee)
    }  
    this.search_attendee = input.value || ''
    this.is_attendee_search_focus = true
    this.FilteredAttendees = this.Attendees.filter((item: any) => 
      item.name.toLowerCase().includes(this.search_attendee.toLowerCase())
    )
  }

  selectAttendee(attendee: any) {
    if (attendee.id == this.selectedAttendee.id) {
      this.selectedAttendee = false
    } else {
      this.selectedAttendee = attendee
      this.search_attendee = ''
      this.attendeeSearchComponent.nativeElement.value = ''
    }
    this.cdr.detectChanges()
    this.is_attendee_search_focus = false
  }

  searchAttendeeFocus(is_focus: boolean = true) {
    this.is_attendee_search_focus = is_focus
    this.FilteredAttendees = this.Attendees
  }

  getAttendeeCheckValue(attendee_id: number) {
    return this.selectedAttendee ? (attendee_id == this.selectedAttendee.id) : false
  }

  attendeeCheckboxKeyed(event: KeyboardEvent, attendee: any) {
    if (event.key === 'Enter') {
      this.selectAttendee(attendee)
    }
  }

  // ========== CALL HISTORY METHODS ==========
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

  applyFilters(): void {
    this.filters = {
      start_date: this.startHiddenDateValue,
      end_date: this.endHiddenDateValue,
      project_id: this.selectedProject ? this.selectedProject.id : '',
      attended_by: this.selectedAttendee ? this.selectedAttendee.id : ''
    };
    this.loadCallHistory();
  }

  resetFilters(): void {
    // Reset Date values
    this.startDateValue = '';
    this.startHiddenDateValue = ''
    this.endDateValue = '';
    this.endHiddenDateValue = ''

    // Reset Project selection
    this.selectedProject = false;
    this.search_project = '';
    if (this.searchComponent) {
      this.searchComponent.nativeElement.value = '';
    }

    // Reset Attendee selection
    this.selectedAttendee = false;
    this.search_attendee = '';
    if (this.attendeeSearchComponent) {
      this.attendeeSearchComponent.nativeElement.value = '';
    }
    
    // Reset filters
    this.filters = {
      start_date: '',
      end_date: '',
      project_id: '',
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

  // ========== DATE METHODS ==========
  startDateValue = ''
  startHiddenDateValue = ''
  endDateValue = ''
  endHiddenDateValue = ''

  onDisplayInputClick(id: string, input_id: string) {
    const dateInput = document.getElementById(id) as HTMLInputElement;
    const startInput = document.getElementById(input_id) as HTMLElement;
    
    setTimeout(() => {
      if (dateInput) {
        const rect = startInput.getBoundingClientRect();

        dateInput.style.position = 'fixed';
        dateInput.style.top = `${rect.top}px`;
        dateInput.style.left = `${rect.right + 5}px`;
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

        setTimeout(() => {
          dateInput.style.position = 'absolute';
          dateInput.style.left = '-9999px';
          dateInput.style.opacity = '0';
          dateInput.style.pointerEvents = 'none';
        }, 500);
      }
    }, 100);
  }

  onDateInputChange(is_start: boolean) {
    if (is_start) {
      if (this.startHiddenDateValue) {
        const date = new Date(this.startHiddenDateValue);
        this.startDateValue = this.formatDateForDisplay(date);
        const endDatePicker = document.getElementById('historyEndDatePicker') as HTMLInputElement;
        if (endDatePicker) {
          endDatePicker.min = this.startHiddenDateValue;
        }
        if (this.endHiddenDateValue && this.endHiddenDateValue < this.startHiddenDateValue) {
          this.endHiddenDateValue = '';
          this.endDateValue = '';
        }
      } else {
        this.startDateValue = '';
        const endDatePicker = document.getElementById('historyEndDatePicker') as HTMLInputElement;
        if (endDatePicker) {
          endDatePicker.removeAttribute('min');
        }
      }
    } else {
      if (this.endHiddenDateValue) {
        const date = new Date(this.endHiddenDateValue);
        this.endDateValue = this.formatDateForDisplay(date);
        // Update max date untuk start date picker
        const startDatePicker = document.getElementById('historyStartDatePicker') as HTMLInputElement;
        if (startDatePicker) {
          startDatePicker.max = this.endHiddenDateValue;
        }
        // Validasi: jika start date lebih besar dari end date, reset start date
        if (this.startHiddenDateValue && this.startHiddenDateValue > this.endHiddenDateValue) {
          this.startHiddenDateValue = '';
          this.startDateValue = '';
        }
      } else {
        this.endDateValue = '';
        // Remove max constraint dari start date picker jika end date di-clear
        const startDatePicker = document.getElementById('historyStartDatePicker') as HTMLInputElement;
        if (startDatePicker) {
          startDatePicker.removeAttribute('max');
        }
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