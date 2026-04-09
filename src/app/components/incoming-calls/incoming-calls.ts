import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallService } from '../../service/call.service';

@Component({
  selector: 'app-incoming-calls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './incoming-calls.html',
  styleUrls: ['./incoming-calls.scss']
})
export class IncomingCalls {

    incomingCallList$!: any;

    constructor(public callService: CallService) {}

    ngOnInit(): void {
      this.incomingCallList$ = this.callService.incomingCallList$;
    }

    acceptCall(callRecord: any){
      this.callService.acceptCallRecord(callRecord);
    }

    rejectCall(callRecord: any){
      this.callService.rejectCallRecord(callRecord);
    }

    stateType = 'standby'
    changeState(type: string) {
      this.callService.changeState(type)
      this.stateType = type
    }

}
