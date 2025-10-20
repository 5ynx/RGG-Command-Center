import { Component } from '@angular/core';
import { CallService } from '../../service/call.service';

@Component({
  selector: 'app-video-calls',
  imports: [],
  templateUrl: './video-calls.html',
  styleUrl: './video-calls.scss'
})
export class VideoCalls {

  
  constructor(private callService: CallService){}

  
  ongoingCallRecord: any;
  
  triggerCall(){
    this.callService.createOffer(false, 'RGG-2', false, true);
  }
  ngOnInit(): void {
    this.callService.ongoingCallRecord$.subscribe(record => {
      this.ongoingCallRecord = record;
    });
  }

  endCall() {
    console.log(this.ongoingCallRecord);
    this.callService.endCallRecord(this.ongoingCallRecord);
  }
}
