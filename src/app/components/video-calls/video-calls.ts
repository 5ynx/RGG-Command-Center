import { ChangeDetectorRef, Component, ElementRef, NgZone, ViewChild } from '@angular/core';
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

    this.callService.callDuration$.subscribe(duration => {
      this.zone.run(() => {
        this.callDuration = duration;
        this.cdr.markForCheck();
      })
    })
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

  endCall() {
    if (this.callStatus == 'calling'){
      this.callService.rejectCall()
    }else{
      this.callService.endCallRecord(this.ongoingCallRecord);
    }
  }
}
