import { ChangeDetectorRef, Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CallService } from '../../service/call.service';

@Component({
  selector: 'app-video-calls',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './video-calls.html',
  styleUrl: './video-calls.scss'
})
export class VideoCalls {
  @ViewChild('remoteVideo', { static: false }) remoteVideoElement!: ElementRef<HTMLVideoElement>;
  
  callDuration: string = '00:00';
  
  constructor(
    private callService: CallService, 
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ){}

  ongoingCallRecord: any;
  callStatus: any;
  screenshotBase64: any = '';

  // Visitor 2nd Gate QR Modal State
  isVisitorModalOpen: boolean = false;
  visitorPhone: string = '';
  visitorName: string = '';
  visitorVehicle: string = '';
  visitorRemarks: string = '';
  isDispatching: boolean = false;
  dispatchError: string = '';
  dispatchSuccess: string = '';
  dispatchChannel: string = 'sms';
  secondGateQrEnabled: boolean = true;

  ngOnInit(): void {
    this.callService.ongoingCallRecord$.subscribe(record => {
      this.ongoingCallRecord = record;
    });

    this.callService.projectVisitorQrConfig$.subscribe(cfg => {
      if (cfg) {
        this.dispatchChannel = cfg.channel || 'sms';
        this.secondGateQrEnabled = cfg.enabled !== false;
      }
    });

    this.callService.callActionStatus$.subscribe(status => {
      this.zone.run(() => {
        this.callStatus = status;
        this.cdr.markForCheck();
      });
    });

    this.callService.callDuration$.subscribe(duration => {
      this.zone.run(() => {
        this.callDuration = duration;
        this.cdr.markForCheck();
      })
    })
  }

  openVisitorModal() {
    this.dispatchError = '';
    this.dispatchSuccess = '';
    this.visitorPhone = '';
    this.visitorName = this.ongoingCallRecord?.caller_name || '';
    this.visitorVehicle = '';
    this.visitorRemarks = '';
    this.isDispatching = false;
    this.isVisitorModalOpen = true;
    this.cdr.detectChanges();
  }

  closeVisitorModal() {
    this.isVisitorModalOpen = false;
    this.cdr.detectChanges();
  }

  sendVisitorQr(openGateAfterDispatch: boolean = false) {
    if (!this.visitorPhone || !this.visitorPhone.trim()) {
      this.dispatchError = 'Visitor phone number is required';
      return;
    }

    const projectId = this.ongoingCallRecord?.project_id || this.callService.getActiveProjectId();
    if (!projectId) {
      this.dispatchError = 'No project associated with this call';
      return;
    }

    this.isDispatching = true;
    this.dispatchError = '';
    this.dispatchSuccess = '';

    const payload = {
      project_id: projectId,
      intercom_id: this.ongoingCallRecord?.intercom_id || '',
      contact_number: this.visitorPhone.trim(),
      visitor_name: (this.visitorName || 'Visitor').trim(),
      vehicle_number: (this.visitorVehicle || '').trim().toUpperCase(),
      call_record_id: this.callService.getActiveCallRecordId() || '',
      remarks: (this.visitorRemarks || '').trim(),
      open_gate: openGateAfterDispatch,
    };

    this.callService.dispatchVisitorQr(payload).subscribe({
      next: (res) => {
        this.isDispatching = false;
        if (res.code === 200) {
          const barcode = res.result?.barcode || '';
          const statusText = res.result?.status || 'Sent';
          this.dispatchSuccess = `Pass ${barcode} dispatched successfully (${statusText})!`;
          if (openGateAfterDispatch) {
            this.openBarrier();
          }
          setTimeout(() => {
            this.closeVisitorModal();
          }, 2500);
        } else {
          this.dispatchError = res.message || 'Failed to dispatch pass';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isDispatching = false;
        this.dispatchError = err?.error?.message || err?.message || 'Error communicating with server';
        this.cdr.detectChanges();
      }
    });
  }

  async takeSnapshot() {
    try {
      const screenshot = await this.captureVideoScreenshot();
      if (screenshot) {
        this.screenshotBase64 = screenshot;
        this.callService.takeSnapshotRecord(this.screenshotBase64);
        this.screenshotBase64 = '';
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error);
    }
  }

  private async triggerBlinkingAnimation(): Promise<void> {
    return new Promise((resolve) => {
      const videoElement = this.remoteVideoElement?.nativeElement || 
                          document.getElementById('remote-video') as HTMLVideoElement;
      
      if (!videoElement) {
        resolve();
        return;
      }
      videoElement.classList.add('blinking-snapshot');
      setTimeout(() => {
        videoElement.classList.remove('blinking-snapshot');
        resolve();
      }, 600);
    });
  }

  private captureVideoScreenshot(): Promise<string | null> {
    return new Promise((resolve) => {
      const videoElement = this.remoteVideoElement?.nativeElement || 
                          document.getElementById('remote-video') as HTMLVideoElement;
      
      if (!videoElement) {
        console.error('Remote video element not found');
        resolve(null);
        return;
      }

      // Check if video has content
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        console.error('Video element has no content');
        resolve(null);
        return;
      }
      
      this.triggerBlinkingAnimation();

      // Create canvas element
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('Could not get canvas context');
        resolve(null);
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Draw video frame to canvas
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      // Convert to base64
      try {
        const base64Data = canvas.toDataURL('image/png');
        const base64Only = base64Data.split(',')[1];
        resolve(base64Only);

      } catch (error) {
        console.error('Error converting to base64:', error);
        resolve(null);
      }
    });
  }

  getResidentProfilePic(){
    return this.callService.getResidentProfilePic(this.ongoingCallRecord);
  }

  endCall() {
    if (this.callStatus == 'calling'){
      this.callService.rejectCall()
    }else{
      this.callService.endCallRecord(this.ongoingCallRecord);
    }
  }

  openBarrier() {
    this.callService.openGate(`Intercom-${this.ongoingCallRecord.intercom_id}`)
  }
}
