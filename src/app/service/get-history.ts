import { Injectable, ɵIS_ENABLED_BLOCKING_INITIAL_NAVIGATION } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { filter, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CallHistory {
  id: number;
  name: string;
  create_date: any;
}

export interface AttendeeSelection {
  id: number;
  name: string;
}

export interface ApiResponse {
  code: number;
  message: string;
  data: CallHistory[];
  attendee: AttendeeSelection[];
  total_records: number;
}

@Injectable({
  providedIn: 'root'
})
export class GetHistory {
  private baseUrl = `${environment.apiUrl}`;
  constructor(private http: HttpClient){}

  getCallHistory(filters: any = {}): Observable<ApiResponse> {
    const url = `${this.baseUrl}/rgg/get-records`;
    const params = new HttpParams({
      fromObject: {
        start_date: filters.start_date || '',
        end_date: filters.end_date || '',
        project_id: filters.project_id || '',
        attended_by: filters.attended_by || ''
      }
    })
    return this.http.get<ApiResponse>(url, { params });
  }

  printCallRecord(recordId: number): Observable<any> {
    const url = `${this.baseUrl}/rgg/download-record/${recordId}`;
    return this.http.get(url, { responseType: 'blob' });
  }

}
