import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallService } from '../../service/call.service';

@Component({
  selector: 'app-missed-calls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './missed-calls.html',
  styleUrl: './missed-calls.scss'
})
export class MissedCalls {

  missedCallList$!: any;

  constructor(private callService: CallService){}

  ngOnInit(): void {
    this.missedCallList$ = this.callService.missedCallList$;
  }

  callBack(callRecord:any){
    if(callRecord.intercom_id){
      this.callService.createOffer(false, `Intercom-${callRecord.intercom_id}`, false, true);
    }else if(callRecord.rgg_id){
      this.callService.createOffer(false, `RGG-${callRecord.rgg_id}`, false, true);
    }else if(callRecord.project_id){
      this.callService.createOffer(false, `Project-${callRecord.project_id}`, false, true);
    }else if(callRecord.family_id){
      this.callService.createOffer(false, callRecord.family_id, false, false);
    }
  }
}
