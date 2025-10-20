import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'
import { ChangeDetectorRef, Component } from '@angular/core';
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
  }

  Intercoms: any = []
  
  isLoading = false
  errMessage = ''

  getIntercoms() {
    this.isLoading = true
    this.ApiUrl.urlApi('/rgg/get-intercom', {project_id: this.selectedProject.id}).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.code === 200) {
          this.Intercoms = response.result;
          this.cdr.detectChanges();
        } else {
          this.errMessage = response.message || 'Failed to load intercom';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errMessage = 'Error fetching data from server';
        console.error('Error fetching load intercom:', err);
      }
    });
  }

  openGate(intercom: any) {
    console.log('open', intercom)
    console.log(this.callService.openGate('Intercom-' + String(3)))
  }

  closeGate(intercom: any) {
    console.log('close', intercom)
    console.log(this.callService.openGate('Intercom-' + String(3)))
  }

  Projects: any = []
  FilteredProjects: any = []
  selectedProject: any = false
  search_project = ''

  loadProjects() {
    this.isLoading = true
    this.ApiUrl.urlApi('/rgg/get-project', {}).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.code === 200) {
          this.Projects = response.result;
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

  searchProject() {
    this.FilteredProjects = this.Projects.filter((item: any) => item.name.toLowerCase().includes(this.search_project))
    console.log(this.FilteredProjects)
  }

  selectProject(project: any) {
    if (project.id == this.selectedProject.id) {
      this.selectedProject = false
      this.Intercoms = []
    } else {
      this.selectedProject = project
      this.search_project = ''
      this.getIntercoms()
    }
  }

  getCheckValue(project_id: number) {
    return this.selectedProject ? (project_id == this.selectedProject.id) : false
  }
}
