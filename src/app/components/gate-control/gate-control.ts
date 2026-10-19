import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { UrlApiService } from '../../service/url-api/url-api.service';
import { CallService } from '../../service/call.service';

@Component({
  selector: 'app-gate-control',
  standalone: true,
  imports: [CommonModule, FormsModule,],
  templateUrl: './gate-control.html',
  styleUrl: './gate-control.scss'
})
export class GateControl implements OnDestroy {

  constructor(private ApiUrl: UrlApiService, private cdr: ChangeDetectorRef, private callService: CallService) {

  }

  private gateResultSub?: Subscription;
  /** True when Intercom action also drove matching LPR barriers (vehicle gate). */
  private lastIntercomAlsoHitLpr = false;

  ngOnInit(): void {
    this.loadProjects();
    document.addEventListener('click', this.handleClickOutside, true);
    this.gateResultSub = this.callService.intercomGateResult$.subscribe((result) => {
      if (result && result.ok === false) {
        // If we already closed/opened matching LPR, device-offline is non-fatal
        if (this.lastIntercomAlsoHitLpr) {
          return;
        }
        this.errMessage = result.error || `Intercom ${result.action || 'gate'} failed`;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.handleClickOutside, true);
    this.gateResultSub?.unsubscribe();
  }

  Gates: any = []
  Intercom: any = []
  ShowGates: any = []
  gateBarrierMode: string = 'gate_only'
  autoGateScheduleEnabled: boolean = false
  autoGateStatus: string = 'closed'

  isGate = false
  isIntercom = false

  isLoading = false
  errMessage = ''

  getGates() {
    this.isLoading = true
    this.Gates = []
    this.ApiUrl.urlApi('/rgg/get-gates', { project_id: this.selectedProject.id }).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.code === 200) {
          this.Gates = response.result.gates;
          this.Intercom = response.result.intercom;
          this.gateBarrierMode = response.result.gate_barrier_mode || 'gate_only';
          this.autoGateScheduleEnabled = response.result.auto_gate_schedule_enabled || false;
          this.autoGateStatus = response.result.auto_gate_status || 'closed';
        } else {
          this.errMessage = response.message || 'Failed to load gates';
        }
        // Rebind the visible list even if that tab is already selected.
        // changeButton used to no-op when isGate/isIntercom was already true,
        // so switching projects left the previous site's gates on screen.
        const showLpr = this.isGate || !this.isIntercom;
        this.changeButton(showLpr)
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errMessage = 'Error fetching data from server';
        console.error('Error fetching load gates:', err);
      }
    });
  }

  openGate(gate: any, is_close: boolean = false, freeze: boolean = false) {
    if (this.isGate) {
      if (freeze && !gate.can_freeze) {
        this.errMessage = 'Freezing is not allowed for this gate';
        return;
      }
      this.triggerLprBarrier(gate, is_close, freeze);
    } else {
      // Intercom tab: pulse the device door via signaling, and also drive matching
      // LPR gates (entry↔in / exit↔out) so Close actually affects the vehicle gate.
      this.errMessage = '';
      const matchingLprs = this.getMatchingLprGates(gate);
      this.lastIntercomAlsoHitLpr = matchingLprs.length > 0;
      if (is_close) {
        this.callService.closeGate(`Intercom-${gate.id}`);
      } else {
        this.callService.openGate(`Intercom-${gate.id}`);
      }
      if (matchingLprs.length === 0) {
        // Socket-only path; offline feedback comes via intercom-gate-result
        return;
      }
      matchingLprs.forEach((lpr: any) => {
        this.triggerLprBarrier(lpr, is_close, false);
      });
    }
  }

  /** Map intercom entry/exit to LPR in/out cameras for the same project. */
  private getMatchingLprGates(intercom: any): any[] {
    if (!this.Gates?.length) {
      return [];
    }
    const type = String(intercom?.intercom_type || '').toLowerCase();
    const cameraType = type === 'entry' ? 'in' : type === 'exit' ? 'out' : '';
    if (!cameraType) {
      return [];
    }
    // Prefer main-gate controls (web relay) so intercom open/close does not also
    // pulse every dual Gate+Barrier row for the same camera.
    const sameSide = this.Gates.filter(
      (g: any) => String(g?.camera_type || '').toLowerCase() === cameraType
    );
    const gatesOnly = sameSide.filter(
      (g: any) => (g?.control_target || g?.target_type || 'gate') === 'gate'
    );
    return gatesOnly.length ? gatesOnly : sameSide;
  }

  private triggerLprBarrier(gateOrId: any, is_close: boolean, freeze: boolean) {
    const cameraId = typeof gateOrId === 'object'
      ? (gateOrId.camera_id ?? gateOrId.id)
      : gateOrId;
    const controlTarget = typeof gateOrId === 'object'
      ? (gateOrId.control_target || gateOrId.target_type || '')
      : '';

    this.ApiUrl.urlApi('/rgg/open-barrier', {
      camera_id: cameraId,
      is_close: is_close,
      freeze: freeze,
      control_target: controlTarget,
    }).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.code !== 200) {
          this.errMessage = response.message || 'Failed to control gate';
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errMessage = 'Error fetching data from server';
        console.error('Error controlling gate:', err);
        this.cdr.detectChanges();
      },
    });
  }

  callIntercom(gate: any) {
    if (gate && gate.id) {
      this.callService.createOfferRecord(false, `Intercom-${gate.id}`, false, false, { intercom_id: gate.id, caller_name: gate.name || 'Intercom' });
    }
  }

  stopRingtone(gate: any) {
    this.callService.stopRingtone(`Intercom-${gate.id}`)
  }

  refreshChamera(gate: any) {
    this.callService.refreshChamera(`Intercom-${gate.id}`)
  }

  restartIntercom(gate: any) {
    this.callService.restartIntercom(`Intercom-${gate.id}`)
  }

  Projects: any = []
  FilteredProjects: any = []
  selectedProject: any = false
  search_project: any = ''

  loadProjects() {
    this.isLoading = true
    this.ApiUrl.urlApi('/rgg/get-project', {}).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.code === 200) {
          this.Projects = response.result;
          this.FilteredProjects = this.Projects
          this.cdr.detectChanges();
        } else {
          this.errMessage = response.message || 'Failed to load project';
        }
      },
      error: (err) => {
        this.isLoading = false;
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
    this.is_search_focus = true
    this.FilteredProjects = this.Projects.filter((item: any) => item.name.toLowerCase().includes(this.search_project))
  }

  is_search_focus = false
  searchFocus(is_focus: boolean = true) {
    this.is_search_focus = is_focus
    this.FilteredProjects = this.Projects
  }

  selectProject(project: any) {
    if (project.id == this.selectedProject.id) {
      this.selectedProject = false
      this.Gates = []
      this.Intercom = []
      this.ShowGates = []
    } else {
      this.selectedProject = project
      this.search_project = ''
      this.searchComponent.nativeElement.value = ''
      this.getGates()
    }
    this.cdr.detectChanges()
    this.is_search_focus = false
  }

  getCheckValue(project_id: number) {
    return this.selectedProject ? (project_id == this.selectedProject.id) : false
  }

  @ViewChild('searchInput') searchComponent!: ElementRef;
  @ViewChild('selectionInput') selectionComponent!: ElementRef;
  handleClickOutside = (event: MouseEvent) => {
    const selectionClicked = this.selectionComponent.nativeElement.contains(event.target);
    const searchClicked = this.searchComponent.nativeElement.contains(event.target);
    if (!searchClicked && !selectionClicked) {
      this.is_search_focus = false
      this.cdr.detectChanges();
    }
  };

  checkboxKeyed(event: KeyboardEvent, project: any) {
    if (event.key === 'Enter') {
      this.selectProject(project)
    }
  }

  changeButton(is_gate: boolean = true) {
    if (is_gate) {
      this.isIntercom = false
      this.isGate = true
      this.ShowGates = this.Gates
    } else {
      this.isIntercom = true
      this.isGate = false
      this.ShowGates = this.Intercom
    }
  }
}
