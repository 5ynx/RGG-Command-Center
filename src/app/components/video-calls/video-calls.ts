import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallService } from '../../service/call.service';

@Component({
  selector: 'app-video-calls',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './video-calls.html',
  styleUrl: './video-calls.scss'
})
export class VideoCalls {
  
  constructor(
    private callService: CallService, 
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ){}

  ongoingCallRecord: any;
  callStatus: any;

  ngOnInit(): void {
    this.callService.ongoingCallRecord$.subscribe(record => {
      this.ongoingCallRecord = record;
    });

    this.callService.callActionStatus$.subscribe(status => {
      this.zone.run(() => {
        this.callStatus = status;
        this.cdr.markForCheck();
      });
    });
  }

  endCall() {
    if (this.callStatus == 'calling'){
      this.callService.rejectCall()
    }else{
      this.callService.endCallRecord(this.ongoingCallRecord);
    }
  }
}
