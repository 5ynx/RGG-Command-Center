import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiResponse {
  code: number;
  message: string;
  result: any;
}

@Injectable({
  providedIn: 'root'
})
export class UrlApiService {

  private baseUrl = `${environment.apiUrl}`;
  constructor(private http: HttpClient){}

  urlApi(url: string, filters: any = {}): Observable<ApiResponse> {
    const urlCon = this.baseUrl + url;
    const params = new HttpParams({
      fromObject: filters
    })
    return this.http.get<ApiResponse>(urlCon, { params });
  }
}
