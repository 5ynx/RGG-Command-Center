import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'
import { ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { UrlApiService } from '../../service/url-api/url-api.service';
import { CallService } from '../../service/call.service';

@Component({
  selector: 'app-gate-control',
  standalone: true,
  imports: [CommonModule, FormsModule, ],
  templateUrl: './gate-control.html',
  styleUrl: './gate-control.scss'
})
export class GateControl {

  constructor(private ApiUrl: UrlApiService, private cdr: ChangeDetectorRef, private callService: CallService) {

  }

  ngOnInit(): void {
    this.loadProjects();
    document.addEventListener('click', this.handleClickOutside, true);
  }

  ngOnDestroy() {
    document.removeEventListener('click', this.handleClickOutside, true);
  }

  Gates: any = []
  
  isLoading = false
  errMessage = ''

  getGates() {
    this.isLoading = true
    this.Gates = []
    this.ApiUrl.urlApi('/rgg/get-gates', {project_id: this.selectedProject.id}).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.code === 200) {
          this.Gates = response.result;
        } else {
          this.errMessage = response.message || 'Failed to load gates';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errMessage = 'Error fetching data from server';
        console.error('Error fetching load gates:', err);
      }
    });
  }

  openGate(gate: any, is_close: boolean = false) {
    this.ApiUrl.urlApi('/rgg/open-barrier', {camera_id: gate.id, is_close: is_close}).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.code === 200) {
        } else {
          this.errMessage = response.message || 'Failed to load gates';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errMessage = 'Error fetching data from server';
        console.error('Error fetching load gates:', err);
      }
    });
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
}
