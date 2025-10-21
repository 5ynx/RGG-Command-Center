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
      // console.log("hello -->", callRecord.intercom_id);
      this.callService.createOfferRecord(false, `Intercom-${callRecord.intercom_id}`, false, true, callRecord);
    }
  }
}
