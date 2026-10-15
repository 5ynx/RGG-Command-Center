import { Injectable, OnDestroy } from '@angular/core';
import { map, Observable, BehaviorSubject, catchError, of } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UrlApiService } from './url-api/url-api.service';
import { Test } from './test';
import { Subject } from 'rxjs';

export interface AuthResponse {
  code: number;
  message: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class CallService implements OnDestroy {
  private socket!: Socket;
  private initialized = false; // mencegah double init
  private peerConnection!: RTCPeerConnection;
  private localStream!: MediaStream;
  private remoteStream!: MediaStream;
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:relay17.expressturn.com:3478' },
    {
      urls: 'turn:relay17.expressturn.com:3478?transport=tcp',
      username: '000000002072154862',
      credential: 'IUtn4d1i+sMuTM1lagsqrzsOBzI='
    }
  ];

  private callerName = '';
  private receiverName = '';
  private callerSocketId: any;
  private receiverSocketId: any;
  private nativeOffer: any;
  private targetSocketIds: any;
  private project_id: any;
  private callAction = '';
  private callerId = 0;
  private receiverId = 0;
  private userName = '';
  private userId = 0;
  private modalLock = false;
  private pendingCandidates: RTCIceCandidate[] = [];
  private callerpendingCandidates: RTCIceCandidate[] = [];
  private remoteDescriptionSet = false;
  private callRecordHistoryId = 0;
  private temporaryOffer: any;
  private audioRecords: any;
  private callStartTime: number = 0;
  private timeInterval: any;
  private ringtoneAudio: HTMLAudioElement | null = null;

  audioStatus = new BehaviorSubject<string>('');
  callActionStatusSubject = new BehaviorSubject<string>('');
  callActionStatus$ = this.callActionStatusSubject.asObservable();
  private incomingCallListSubject = new BehaviorSubject<any[]>([]);
  incomingCallList$ = this.incomingCallListSubject.asObservable();
  private missedCallListSubject = new BehaviorSubject<any[]>([]);
  missedCallList$ = this.missedCallListSubject.asObservable();
  private ongoingCallRecordSubject = new BehaviorSubject<any>(null);
  ongoingCallRecord$ = this.ongoingCallRecordSubject.asObservable()
  private refreshHistoryTrigger = new Subject<void>();
  refreshHistoryTrigger$ = this.refreshHistoryTrigger.asObservable();
  private callDurationSubject = new BehaviorSubject<string>('00:00');
  callDuration$ = this.callDurationSubject.asObservable();

  constructor(
    private route: ActivatedRoute,
    protected http: HttpClient,
    private ApiUrl: UrlApiService,
    private test: Test
  ) {
    // this.initializeSocket();
  }

  async initializeSocket() {
    try{
      if (this.initialized) return;
      this.initialized = true;
      const user = this.test.getStoredUserPublic();
      if (!user) {
        console.error('User belum login.');
        return;
      }
      const currentUser = Array.isArray(user) ? user[0] : user;
      this.userId = currentUser.user_id;
      this.userName = `Command Center - ${currentUser.user_id}`;
    
      this.socket = io('wss://ws.sgeede.com', {
        query: { uniqueId: currentUser.user_id ? `RGG-${currentUser.user_id}` : 'Public-user' },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        transports: ['websocket', 'polling'],
      });
      this.refreshCallLog();

      this.socket.on('offer', (offer: any) => this.handleOffer(offer));
      this.socket.on('answer', (answer: any) => this.handleAnswer(answer));
      this.socket.on('ice-candidate', (candidate: any) => this.handleICECandidate(candidate));
      this.socket.on('end-call', () => this.handleEndCall());
      this.socket.on('reject-call', () => this.handleRejectCall());
      this.socket.on('call-timeout', () => { this.handleRejectCall(); this.refreshCallLog(); });
      this.socket.on('kick-user', (data: any) => this.cleanup());
      this.socket.on('user-not-found', (data: any) => this.handleUserNotFound(data));
      this.socket.on('receiver-info', (data: any) => this.handleReceiverInfo(data));
      this.socket.on('receiver-pending-call', (data: any) => this.handleReceiverPendingCall(data));
      this.socket.on('sender-pending-call', (data: any) => this.handleSenderPendingCall(data));
      this.socket.on('open-modal-call', (data: any) => this.handleOngoingCallModal());
      this.socket.on('refresh-incoming-call', (data: any) => this.refreshCallLog());
      this.socket.on('intercom-gate-result', (data: any) => this.handleIntercomGateResult(data));
    } catch (error) {
      console.error('Error during socket initialization:', error);
    }
  }

  /** Last intercom gate socket result (for Gate Control UI). */
  private intercomGateResultSubject = new BehaviorSubject<any>(null);
  intercomGateResult$ = this.intercomGateResultSubject.asObservable();

  private handleIntercomGateResult(data: any) {
    console.log('[intercom-gate-result]', data);
    this.intercomGateResultSubject.next(data);
  }
  

  getSocket(): Socket {
    return this.socket;
  }

  cleanup() {
    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  async showIncomingCallModal(offer: any) {
    console.log("Getting here btw -->")
    // this.temporaryOffer = offer;
    // if (this.callerName) {
    //   await this.playRingtone();
    //   return this.presentSingletonModal(IncomingCallPage, {
    //     offer: offer,
    //     callerName: this.callerName,
    //   });
    // }
  }

  async showOutgoingCallModal() {
    // return this.presentSingletonModal(OutgoingCallPage, {
    //   receiverName: this.receiverName,
    // });
  }

  isReceiver = false
  async showOngoingCallModal(isReceiver: boolean) {
    console.log("after acceptedd");
    this.regenerateVideo();
    // this.isReceiver = isReceiver
    // const topModal = await this.modalController.getTop();
    // if (topModal) {
    //   try {
    //     await topModal.dismiss();
    //   } catch (e) {
    //     console.warn('Gagal dismiss modal lama:', e);
    //   }
    // }
    // // this.startRecording()
    // return this.presentSingletonModal(OngoingCallPage, {
    //   isReceiver,
    // });
  }

  async showSplashScreen() {
    // return this.presentSingletonModal(SplashCallPage);
  }

  private startCallTimer() {
    this.callStartTime = Date.now();
    this.stopCallTimer();

    this.timeInterval = setInterval(() => {
      const elapsed = Date.now() - this.callStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      this.callDurationSubject.next(formattedTime);
    }, 1000);
  }

  private stopCallTimer() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
    this.callDurationSubject.next('00:00');
  }

  private async resetCallData() {
    try {
      this.stopCallTimer();

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null!;
      }

      this.remoteStream = null!;

      if (this.peerConnection) {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.close();
        this.peerConnection = null!;
      }

      this.callerName = '';
      this.receiverName = '';
      this.callerSocketId = null;
      this.receiverSocketId = null;
      this.nativeOffer = null;
      this.targetSocketIds = null;
      this.project_id = null;
      this.callAction = '';
      this.audioRecords = '';
      this.pendingCandidates = [];
      this.callerpendingCandidates = [];
      this.remoteDescriptionSet = false;
      this.callActionStatusSubject.next('');
      this.ongoingCallRecordSubject.next(null);
      this.callStartTime = 0;

      localStorage.removeItem('callData');
    } catch (error) {
      console.error('Error during clearCallData:', error);
    }
  }

  async startLocalStream(activate_video: boolean = false): Promise<boolean> {
    try {
      // 1. Cek apakah MediaDevices API tersedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API or getUserMedia not available');
        return false;
      }

      // 2. iOS-specific constraints - lebih konservatif
      const constraints = {
        video: activate_video,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // iOS Safari kadang bermasalah dengan constraint tambahan
          // Hapus atau simplify jika masih bermasalah
          sampleRate: 44100, // iOS prefer standard sample rate
          channelCount: 1     // Mono audio untuk iOS
        }
      };

      console.log('Requesting media permissions...');

      // 3. Request stream dengan error handling yang lebih detail
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!this.localStream) {
        console.error('Failed to get media stream');
        return false;
      }

      console.log('Media stream obtained successfully');

      // 4. Handle video element dengan iOS-specific considerations
      const videoElement: HTMLVideoElement = document.getElementById('local-video') as HTMLVideoElement;
      if (videoElement) {
        // iOS Safari memerlukan properti tambahan
        videoElement.srcObject = this.localStream;
        videoElement.muted = true; // Penting untuk iOS - hindari feedback
        videoElement.playsInline = true; // Crucial untuk iOS - hindari fullscreen
        videoElement.autoplay = true; // iOS Safari memerlukan autoplay

        // iOS Safari kadang memerlukan user interaction untuk play
        try {
          await videoElement.play();
          console.log('Video element playing successfully');
        } catch (playError) {
          console.warn('Auto-play failed, might need user interaction:', playError);
          // Untuk iOS, kadang perlu user click untuk trigger play
          // Anda bisa show button "Tap to start" jika auto-play gagal
        }
      } else {
        console.warn('Video element not found');
      }

      return true;
    } catch (error) {
      console.error('Error starting local stream:', error);

      // Type guard untuk error handling
      if (error instanceof Error) {
        // Detail error handling untuk debugging
        if (error.name === 'NotAllowedError') {
          console.error('Permission denied by user');
        } else if (error.name === 'NotFoundError') {
          console.error('No audio input device found');
        } else if (error.name === 'NotReadableError') {
          console.error('Audio device is already in use');
        } else if (error.name === 'OverconstrainedError') {
          console.error('Constraints cannot be satisfied');
        } else if (error.name === 'SecurityError') {
          console.error('Security error - HTTPS required');
        }
      } else {
        console.error('Unknown error type:', error);
      }

      return false;
    }
  }

  async regenerateVideo() {
    if (!navigator.mediaDevices) {
      return;
    }
    const videoElement: HTMLVideoElement = document.getElementById('local-video') as HTMLVideoElement;
    if (videoElement && this.localStream) {
      videoElement.srcObject = this.localStream;
      videoElement.muted = true;
      videoElement.playsInline = true;
      try {
        await videoElement.play();
      } catch (e) {
        console.warn('local-video play failed:', e);
      }
    }
    const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
    if (remoteVideo && this.remoteStream) {
      remoteVideo.srcObject = this.remoteStream;
      remoteVideo.playsInline = true;
      remoteVideo.autoplay = true;
      try {
        await remoteVideo.play();
      } catch (e) {
        console.warn('remote-video play failed:', e);
      }
    }
  }

  /** offer_obj / target_socket_ids may arrive as JSON strings from Odoo Json fields */
  private parseJsonField<T = any>(value: any): T | any {
    if (value == null || value === '') {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  private attachRemoteStream(stream: MediaStream) {
    this.remoteStream = stream;
    const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
    if (remoteVideo) {
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      remoteVideo.autoplay = true;
      remoteVideo.play().catch((e) => console.warn('remote-video play failed:', e));
    }
  }

  async createOfferRecord(receiverPhone: any = false, receiverId: any = false, unit_id: any = false, isResident: any = false, callRecord: any) {
    if (!receiverId && !receiverPhone && !unit_id) {
      return;
    }
    this.ongoingCallRecordSubject.next(callRecord);
    let is_intercom = String(receiverId).includes('Intercom-');
    if (is_intercom) {
      isResident = false;
    }
    let activate_video = is_intercom ? true : false ;
    await this.startLocalStream(activate_video);

    this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: 'all' });

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', event.candidate);
        this.callerpendingCandidates.push(event.candidate);
      }
    };

      this.peerConnection.ontrack = (event) => {
        const stream = event.streams?.[0] || new MediaStream([event.track]);
        this.attachRemoteStream(stream);
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection.iceConnectionState;

        switch (state) {
          case "checking":
            this.updateAudioStatus("Connecting audio...");
            break;
          case "connected":
          case "completed":
            this.updateAudioStatus("Audio connected");
            this.regenerateVideo();
            break;
        }
      };

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.callerName = this.userName;
      this.callerId = this.userId;
      console.log(receiverId)
      this.socket.emit('offer', {
      offerObj: offer,
      receiverPhone: receiverPhone,
      receiverId: receiverId,
      callerName: this.callerName,
      callerId: this.callerId,
      unitId: unit_id,
      isResident: isResident
    });

    return 'done'
  }

  async handleOffer(offer: any) {
    console.log(offer)
    await this.startLocalStream();
    if (!this.peerConnection) {
      this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: 'all' });

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('ice-candidate', event.candidate);
        }
      };

      this.peerConnection.ontrack = (event) => {
        const stream = event.streams?.[0] || new MediaStream([event.track]);
        this.attachRemoteStream(stream);
      };
      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection.iceConnectionState;

        switch (state) {
          case "checking":
            this.updateAudioStatus("Connecting audio...");
            break;
          case "connected":
          case "completed":
            this.updateAudioStatus("Audio connected");
            this.regenerateVideo();
            break;
        }
      };
    } else {
    }
    this.callerName = offer.callerName;
    this.callerId = offer.callerId;
    this.receiverId = offer.receiverId;
    this.receiverName = offer.receiverName;
    this.callerSocketId = offer.callerSocketId;
    this.receiverSocketId = offer.receiverSocketId;
    this.targetSocketIds = offer.targetSocketIds;
    this.project_id = offer.project_id;
    await this.showIncomingCallModal(offer.offerObj);
  }

  /**
   * Open / navigate the VMS window for the accepted call.
   * Pass `existingWindow` from a sync window.open() on the Accept click so
   * popup blockers do not kill the async post-API open.
   */
  async openNewVMS(project_id: any = '', existingWindow: Window | null = null) {
    const rgg_data = localStorage.getItem('rgg_dashboard_auth');
    if (!rgg_data) {
      console.error('openNewVMS: missing rgg_dashboard_auth');
      if (existingWindow && !existingWindow.closed) {
        existingWindow.close();
      }
      return;
    }

    const projectId = project_id || this.project_id;
    if (!projectId) {
      console.error('openNewVMS: missing project_id');
      if (existingWindow && !existingWindow.closed) {
        existingWindow.close();
      }
      return;
    }

    try {
      const rgg_auth: any = JSON.parse(rgg_data);
      const userId = rgg_auth?.user?.[0]?.user_id;
      if (!userId) {
        console.error('openNewVMS: missing user_id in auth');
        if (existingWindow && !existingWindow.closed) {
          existingWindow.close();
        }
        return;
      }

      const base = String(environment.vmsUrl || '').replace(/\/+$/, '');
      const url =
        `${base}?project_id=${encodeURIComponent(projectId)}` +
        `&user_id=${encodeURIComponent(userId)}` +
        `&call_id=${encodeURIComponent(String(this.callRecordHistoryId || ''))}`;

      if (existingWindow && !existingWindow.closed) {
        existingWindow.location.href = url;
      } else {
        window.open(url, 'myWindow', 'width=800,height=900,left=100,top=100');
      }
    } catch (e) {
      console.error('openNewVMS failed:', e);
      if (existingWindow && !existingWindow.closed) {
        existingWindow.close();
      }
    }
  }

  async handleAnswer(answer: any) {
    // await this.stopOutgoingRingtone();
    // await this.stopRingtone();
    this.callActionStatusSubject.next('');
    this.createCallRecordHistory(this.ongoingCallRecordSubject.value);
    this.updateCallRecordState(this.ongoingCallRecordSubject.value.id, 'accepted');
    this.callerName = answer.callerName;
    this.receiverName = answer.receiverName;
    this.receiverSocketId = answer.receiverSocketId;
    const description = new RTCSessionDescription(answer.answerObj);
    await this.peerConnection.setRemoteDescription(description);
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      await this.peerConnection.addIceCandidate(candidate);
    }

    await this.showOngoingCallModal(false);
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (!this.remoteStream) {
        const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
        remoteVideo.srcObject = this.remoteStream;
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;

      console.log(state)
      switch (state) {
        case "checking":
          this.updateAudioStatus("Connecting audio...");
          break;
        case "completed":
          this.updateAudioStatus("Audio connected");
          break;
      }
    };
    this.startRecordingWithWebAudio(this.localStream, this.remoteStream)
    this.startCallTimer();
  }

  async handleICECandidate(candidate: RTCIceCandidate): Promise<void> {
    if (typeof window === 'undefined' || typeof RTCIceCandidate === 'undefined') {
      console.warn('RTCIceCandidate is not available in this environment.');
      return;
    }

    const iceCandidate = new RTCIceCandidate(candidate);
    if (this.remoteDescriptionSet) {
      await this.peerConnection.addIceCandidate(iceCandidate);
    } else {
      this.pendingCandidates.push(iceCandidate);
    }
  }

  async handleSenderPendingCall(data: any) {
    this.receiverSocketId = data.receiverSocketId;
    this.receiverId = data.receiverId;
    console.log('pending', this.receiverId)

    for (const candidate of this.callerpendingCandidates) {
      this.socket.emit('ice-candidate', candidate);
    }
  }

  family_id: any = false
  decoded: any = {}

  async handleReceiverPendingCall(data: any) {
    this.nativeOffer = data.offerObj;
    this.callerId = data.callerId;
    this.callerSocketId = data.callerSocketId;
    this.receiverSocketId = data.receiverSocketId;
    this.targetSocketIds = data.targetSocketIds;
    this.project_id = data.project_id;
    if (this.callAction === 'acceptCall') {
      await this.startLocalStream();
      if (!this.peerConnection) {
        // Inisialisasi peerConnection untuk User 2
        this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: 'all' });

        // Pastikan remote stream belum ada
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }

        // Set up ICE candidate handler
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.socket.emit('ice-candidate', event.candidate);
          }
        };

        // Set up track handler untuk remote video
        this.peerConnection.ontrack = (event) => {
          this.remoteStream = event.streams[0];
          const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
          if (remoteVideo) {
            remoteVideo.srcObject = this.remoteStream;
          }
        };
        this.peerConnection.oniceconnectionstatechange = () => {
          const state = this.peerConnection.iceConnectionState;

          switch (state) {
            case "checking":
              this.updateAudioStatus("Connecting audio...");
              break;
            case "connected":
            case "completed":
              this.updateAudioStatus("Audio connected");
              break;
          }
        };
      } else {
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.nativeOffer));
      this.remoteDescriptionSet = true;
      for (const candidate of this.pendingCandidates) {
        await this.peerConnection.addIceCandidate(candidate);
      }

      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emit('answer', {
        answerObj: answer,
        receiverName: this.receiverName,
        callerName: this.callerName,
        callerSocketId: this.callerSocketId,
        receiverSocketId: data.receiverSocketId,
      });

      await this.showOngoingCallModal(true);
    } else if (this.callAction === 'rejectCall') {
      this.rejectCall();
      // }else if(this.callAction === 'openDialogCall'){
    } else {
      if (!this.callerName) return
      await this.startLocalStream();
      if (!this.peerConnection) {
        this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: 'all' });

        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }

        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.socket.emit('ice-candidate', event.candidate);
          }
        };

        this.peerConnection.ontrack = (event) => {
          this.remoteStream = event.streams[0];
          const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
          if (remoteVideo) {
            remoteVideo.srcObject = this.remoteStream;
          }
        };
        this.peerConnection.oniceconnectionstatechange = () => {
          const state = this.peerConnection.iceConnectionState;

          switch (state) {
            case "checking":
              this.updateAudioStatus("Connecting audio...");
              break;
            case "connected":
            case "completed":
              this.updateAudioStatus("Audio connected");
              break;
          }
        };
      }
      await this.showIncomingCallModal(this.nativeOffer);
    }
  }

  async acceptCallRecord(callRecord: any) {
    // Open VMS window synchronously with the Accept click so popup blockers allow it.
    // URL is filled in after /rgg/create-records returns.
    let vmsWindow: Window | null = null;
    try {
      vmsWindow = window.open('about:blank', 'myWindow', 'width=800,height=900,left=100,top=100');
    } catch (e) {
      console.warn('Could not pre-open VMS window:', e);
    }

    this.ongoingCallRecordSubject.next(callRecord);
    this.callActionStatusSubject.next('');
    this.project_id = callRecord.project_id || this.project_id;
    this.createCallRecordHistory(callRecord, vmsWindow);

    console.log('====== acceptCallRecord', callRecord);
    this.callerName = callRecord.caller_name;
    const offer = this.parseJsonField(callRecord.offer_obj);
    this.callerSocketId = callRecord.caller_socket_id;
    this.receiverSocketId = callRecord.receiver_socket_id;
    this.targetSocketIds = this.parseJsonField(callRecord.target_socket_ids);

    if (!offer || !offer.type || !offer.sdp) {
      console.error('acceptCallRecord: invalid offer_obj', callRecord.offer_obj);
      this.updateAudioStatus('Invalid call offer');
      if (vmsWindow && !vmsWindow.closed) {
        vmsWindow.close();
      }
      return;
    }

    const streamOk = await this.startLocalStream(false);
    if (!streamOk || !this.localStream) {
      console.error('acceptCallRecord: failed to get local media');
      this.updateAudioStatus('Microphone permission required');
      if (vmsWindow && !vmsWindow.closed) {
        vmsWindow.close();
      }
      return;
    }

    // Always rebuild PC when accepting a queued call so we don't reuse a stale connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null!;
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: 'all',
    });
    this.remoteStream = new MediaStream();
    this.remoteDescriptionSet = false;
    // Keep any ICE candidates buffered while the call was ringing in the RGG queue.
    // Clearing them here was a common cause of black video (no media path).

    this.localStream.getTracks().forEach((track) => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      if (event.track) {
        // Prefer accumulating into one remote stream so audio+video both attach
        const already = this.remoteStream?.getTracks().some((t) => t.id === event.track.id);
        if (!already) {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
          }
          this.remoteStream.addTrack(event.track);
        }
      } else if (stream) {
        this.remoteStream = stream;
      }
      this.attachRemoteStream(this.remoteStream);
      this.updateAudioStatus('Media connected');
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log('[acceptCallRecord] iceConnectionState:', state);
      switch (state) {
        case 'checking':
          this.updateAudioStatus('Connecting media...');
          break;
        case 'connected':
        case 'completed':
          this.updateAudioStatus('Media connected');
          this.regenerateVideo();
          break;
        case 'failed':
          this.updateAudioStatus('Media connection failed');
          break;
        case 'disconnected':
          this.updateAudioStatus('Media disconnected');
          break;
      }
    };

    this.updateCallRecordState(callRecord.id, 'ongoing');

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      this.remoteDescriptionSet = true;
      for (const candidate of this.pendingCandidates) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
        } catch (e) {
          console.warn('Failed to add pending ICE candidate:', e);
        }
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.receiverSocketId = this.socket.id;
      this.socket.emit('answer', {
        answerObj: answer,
        receiverName: this.receiverName || 'Command Center',
        callerName: this.callerName,
        callerSocketId: this.callerSocketId,
        receiverSocketId: this.receiverSocketId,
      });

      this.startCallTimer();
      await this.showOngoingCallModal(true);
      // Retry attach after UI paints Ongoing Call video element
      setTimeout(() => this.regenerateVideo(), 250);

      try {
        this.startRecordingWithWebAudio(this.localStream, this.remoteStream);
      } catch (e) {
        console.warn('startRecordingWithWebAudio failed:', e);
      }
    } catch (e) {
      console.error('acceptCallRecord WebRTC failed:', e);
      this.updateAudioStatus('Failed to connect call');
      if (vmsWindow && !vmsWindow.closed) {
        vmsWindow.close();
      }
    }
  }

  async handleOngoingCallModal() {
    console.log("Trigger kash herrrrr ---->", this.targetSocketIds);
    if (this.targetSocketIds) {
      let newTargetSocketIds = this.targetSocketIds.filter((target: any) => target != this.receiverSocketId);
      this.socket.emit('reject-call', {
        targetSocketIds: newTargetSocketIds,
        project_id: this.project_id,
      });
    }
    await this.showOngoingCallModal(true);
  }

  async endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null!;
    }

    if (this.socket) {
      console.log(this.receiverId, this.callerId)
      console.log('receiver:', this.receiverSocketId, 'caller', this.callerSocketId)
      this.socket.emit('end-call', {
        receiverSocketId: this.receiverSocketId,
        callerSocketId: this.callerSocketId
      });
    }
    await this.closeModal();
    this.resetCallData();
  }

  async takeSnapshotRecord(screenshotBase64: any) {
    if(!screenshotBase64 || !this.callRecordHistoryId){
      return;
    }
    
    const apiUrl = `${environment.apiUrl}/rgg/update-records`;
    const body = {
      active_call_id: this.callRecordHistoryId,
      screenshot_binary: screenshotBase64
    };
    
    this.http.post<any>(apiUrl, body).subscribe({
      next: (response) => {
        console.log('Saving screenshot into call record history:', response);
      },
      error: (err) => console.error('Error saving screenshot into call record history:', err),
    });
  } 

  async endCallRecord(callRecord: any) {
    if(!callRecord){
      return;
    }
    console.log("============= end call");
    console.log(callRecord);
    this.updateCallRecordState(callRecord.id, 'accepted');

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null!;
    }

    if (this.socket) {
      console.log(this.receiverId, this.callerId)
      console.log('receiver:', this.receiverSocketId, 'caller', this.callerSocketId)
      this.socket.emit('end-call', {
        receiverSocketId: this.receiverSocketId,
        callerSocketId: this.callerSocketId
      });
    }
    await this.closeModal();
    // this.resetCallData();
  }

  async handleEndCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null!;
    }
    await this.closeModal();
    this.stopRecordingWithWebAudio()
    this.resetCallData();
  }

  async handleRejectCall() {
    // await this.stopOutgoingRingtone();
    // await this.stopRingtone();
    await this.closeModal();
    this.resetCallData();
    this.refreshCallLog();
    console.log("get rejectted -->")
  }

  async rejectCallRecord(callRecord: any) {
    // await this.stopOutgoingRingtone();
    // await this.stopRingtone();
    console.log(callRecord);
    this.callerName = callRecord.caller_name;
    const offer = callRecord.offer_obj;
    this.callerSocketId = callRecord.caller_socket_id;
    this.receiverSocketId = callRecord.receiver_socket_id;
    this.targetSocketIds = callRecord.target_socket_ids;

    this.updateCallRecordState(callRecord.id, 'rejected');
    this.socket.emit('reject-call', {
      callerSocketId: this.callerSocketId,
      receiverSocketId: this.receiverSocketId,
      targetSocketIds: this.targetSocketIds,
      project_id: this.project_id,
      receiverId: this.receiverId,
      callerId: this.callerId,
      callerName: this.callerName
    });
    await this.closeModal();
    this.resetCallData();
  }

  async rejectCall() {
    // await this.stopOutgoingRingtone();
    // await this.stopRingtone();
    this.socket.emit('reject-call', {
      callerSocketId: this.callerSocketId,
      receiverSocketId: this.receiverSocketId,
      targetSocketIds: this.targetSocketIds,
      project_id: this.project_id,
      receiverId: this.receiverId,
      callerId: this.callerId,
      callerName: this.callerName
    });
    await this.closeModal();
    this.resetCallData();
  }

  muteLocalAudio() {
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
    }
  }

  muteLocalVideo() {
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
    }
  }

  getLocalCam() {
    console.log('local cam', this.localStream.getVideoTracks(), (this.localStream.getVideoTracks().length > 0 ? this.localStream.getVideoTracks()[0].enabled : false))
    return this.localStream.getVideoTracks().length > 0 ? this.localStream.getVideoTracks()[0].enabled : false
  }

  getRemoteCam() {
    console.log('remote cam', this.remoteStream.getVideoTracks(), (this.remoteStream.getVideoTracks().length > 0 ? this.remoteStream.getVideoTracks()[0].enabled : false))
    return this.remoteStream.getVideoTracks().length > 0 ? this.remoteStream.getVideoTracks()[0].enabled : false
  }

  muteRemoteSpeaker() {
    const videoElement: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
    if (videoElement) {
      videoElement.muted = !videoElement.muted;
    }
  }

  async handleReceiverInfo(data: any) {
    console.log('handle receiver', data)
    this.callerId = data.callerId;
    this.receiverId = data.receiverId;
    this.callerName = data.callerName;
    this.receiverName = data.receiverName;
    this.callerSocketId = data.callerSocketId;
    this.receiverSocketId = data.receiverSocketId;
    this.targetSocketIds = data.targetSocketIds;
    this.project_id = data.project_id;
    // await this.playOutgoingRingtone();
    // await this.showOutgoingCallModal();
  }

  async handleUserNotFound(data: any) {
    console.log("user not found btw", data);
    await this.rejectCall();
    // this.presentToast(data.message, 'danger');
  }

  async receiverConnected() {
    this.socket.emit('receiver-connected', {});
  }

  async closeModal() {
    // const topModal = await this.modalController.getTop();
    // if (topModal) {
    //   try {
    //     await topModal.dismiss();
    //   } catch (e) {
    //     console.warn('Gagal dismiss modal aktif:', e);
    //   }
    // }
  }

  getCallerName() {
    return this.callerName;
  }
  getReceiverName() {
    return this.receiverName;
  }

  getSenderProfilePic() {
    if (this.callerId.toString().includes('Intercom')) {
      return `${environment.apiUrl}/web/image/fs.residential.family/${0}/image_profile`;
    } else {
      return `${environment.apiUrl}/web/image/fs.residential.family/${this.callerId}/image_profile`;
    }
  }
  getReceiverProfilePic() {
    if (this.receiverId.toString().includes('Intercom')) {
      return `${environment.apiUrl}/web/image/fs.residential.family/${0}/image_profile`;
    } else {
      return `${environment.apiUrl}/web/image/fs.residential.family/${this.receiverId}/image_profile`;
    }
  }

  updateAudioStatus(status: string) {
    this.audioStatus.next(status);
  }
  async actionMinimize() {
    const outerDiv = document.querySelector('ion-modal.non-blocking-modal');
    outerDiv?.classList.add('minimize-call-modal')
  }

  async actionMaximize() {
    const outerDiv = document.querySelector('ion-modal.non-blocking-modal');
    outerDiv?.classList.remove('minimize-call-modal')
  }

  mediaRecorder!: MediaRecorder;
  recordedChunks: BlobPart[] = [];

  combineStreams(streams: any) {
    const combined = new MediaStream();
  
    streams.forEach((stream: any) => {
      stream.getAudioTracks().forEach((track: any) => combined.addTrack(track));
    });
    console.log(combined)
  
    return combined;
  }

  async startRecording() {
    // const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const combinedStream = this.combineStreams([this.localStream, this.remoteStream]);
    console.log(combinedStream)

    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: 'audio/webm'
    });
    console.log(this.mediaRecorder)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };
    console.log()

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, {
        type: 'audio/webm' // atau 'audio/webm' 
      }); // Simpan atau upload blob 
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url; 
      a.download = 'recorded-call.webm';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
    };

    this.mediaRecorder.start();
  }

  startRecordingWithWebAudio(localStream: any, remoteStream: any) {
    this.recordedChunks = [];

    const audioCtx = new AudioContext();

    const dest = audioCtx.createMediaStreamDestination();

    // Create sources
    if (localStream && localStream.getAudioTracks().length > 0) {
      const localSource = audioCtx.createMediaStreamSource(localStream);
      localSource.connect(dest);
    }
    
    if (remoteStream && remoteStream.getAudioTracks().length > 0) {
      const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
      remoteSource.connect(dest);
    }

    // Record from mixed stream
    this.mediaRecorder = new MediaRecorder(dest.stream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, {
        type: 'audio/webm'
      });
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64Audio = reader.result;
        this.audioRecords = base64Audio;
        
        const payload = {
          audio: base64Audio,
          caller_id: this.callerId,
          receiver_id: this.receiverId,
          project_id: this.project_id
        };
        
        // console.log(payload)
        
        this.ApiUrl.urlApiPost('/call/post/recorded_call', payload).subscribe({
            next: (res) => console.log(res),
            error: (err) => console.error(err)
          });

        // Save ke Penyimpanan RGG
        console.log('Kalau masih blm siap, selesaikan api end call records', this.callRecordHistoryId)

        const apiUrl = `${environment.apiUrl}/rgg/update-records-end-call`;
        const body = {
          active_call_id: this.callRecordHistoryId,
          audio_binary: this.audioRecords.split(',')[1]
        };
        
        this.http.post<any>(apiUrl, body).subscribe({
          next: (response) => {
            console.log('Saving audio into call record history:', response);
          },
          error: (err) => console.error('Error saving audio into call record history:', err),
        });
    
      };

      audioCtx.close()
      // this.mediaRecorder.stop()
    };

    this.mediaRecorder.start();
  }

  stopRecordingWithWebAudio() {
    this.mediaRecorder
    this.mediaRecorder.stop();
  }

  getIsFromIntercom() {
    // let id = this.isReceiver ? this.callerId : this.receiverId
    // return id ? id.toString().includes('Intercom') : false
  }

  refreshCallLog(){
    this.refreshIncomingCall();
    this.refreshMissedCall();
    this.refreshHistoryTrigger.next();
  }

  refreshIncomingCall() {
    const apiUrl = `${environment.apiUrl}/rgg/get-call`;
    const params = {
      call_state: 'waiting',
    };
    
    this.http.get<any>(apiUrl, {params}).subscribe({
      next: (response) => {
        const list = Array.isArray(response) 
          ? response 
          : response.data ?? [];
        this.incomingCallListSubject.next(list);
        if (list.length > 0 && this.rggState == 'standby') {
          this.startRingtone();
        } else {
          this.endRingtone();
        }
      },
      error: (err) => console.error('Error fetching call list:', err),
    });
  }

  refreshMissedCall() {
    const apiUrl = `${environment.apiUrl}/rgg/get-call`;
    const params = {
      call_state: 'missed',
    };
    
    this.http.get<any>(apiUrl, {params}).subscribe({
      next: (response) => {
        const list = Array.isArray(response) 
          ? response 
          : response.data ?? [];
        this.missedCallListSubject.next(list);
      },
      error: (err) => console.error('Error fetching missed call list:', err),
    });
  }

  async updateCallRecordState(recordId: Number, state: String){{
    const apiUrl = `${environment.apiUrl}/rgg/update-state`;
    const body = {
      id: recordId,
      call_state: state,
    };
    
    this.http.post<any>(apiUrl, body).subscribe({
      next: (response) => {
        console.log('Updated call missed list:', response);
        this.refreshCallLog();
      },
      error: (err) => console.error('Error updating call state:', err),
    });
  }}

  async openGate(intercom_id: any) {
    if (!this.socket?.connected) {
      this.intercomGateResultSubject.next({
        ok: false,
        action: 'open',
        intercom_id,
        error: 'Command Center is not connected to signaling',
      });
      return;
    }
    this.socket.emit('intercom-open-gate', { intercom_id: intercom_id, opened_by: 'rgg' });
  }

  async closeGate(intercom_id: any) {
    if (!this.socket?.connected) {
      this.intercomGateResultSubject.next({
        ok: false,
        action: 'close',
        intercom_id,
        error: 'Command Center is not connected to signaling',
      });
      return;
    }
    this.socket.emit('intercom-close-gate', { intercom_id: intercom_id });
  }

  stopRingtone(intercom_id: any) {
    this.socket.emit('intercom-stop-ringtone', { intercom_id: intercom_id });
  }

  refreshChamera(intercom_id: any) {
    this.socket.emit('intercom-refresh-camera', { intercom_id: intercom_id });
  }

  restartIntercom(intercom_id: any) {
    this.socket.emit('intercom-restart-app', { intercom_id: intercom_id });
  }

  async createCallRecordHistory(callRecord: any, vmsWindow: Window | null = null) {
    if (!callRecord) {
      if (vmsWindow && !vmsWindow.closed) {
        vmsWindow.close();
      }
      return;
    }

    const apiUrl = `${environment.apiUrl}/rgg/create-records`;
    const body = {
      intercom_id: callRecord.intercom_id || '',
      caller_name: callRecord.caller_name,
      family_id: callRecord.family_id || '',
      project_id: callRecord.project_id || this.project_id || '',
      attended_by: this.userId,
    };

    this.http.post<any>(apiUrl, body).subscribe({
      next: (response) => {
        console.log('Create call record history:', response);
        this.refreshCallLog();
        this.callRecordHistoryId = response.data;
        const projectId =
          response.project_id || callRecord.project_id || this.project_id;
        if (projectId) {
          this.project_id = projectId;
          this.openNewVMS(projectId, vmsWindow);
        } else {
          console.error('createCallRecordHistory: no project_id to open VMS');
          if (vmsWindow && !vmsWindow.closed) {
            vmsWindow.close();
          }
        }
      },
      error: (err) => {
        console.error('Error creating call record history:', err);
        // Still try to open VMS with known project_id so operators can work the site
        const projectId = callRecord.project_id || this.project_id;
        if (projectId) {
          this.openNewVMS(projectId, vmsWindow);
        } else if (vmsWindow && !vmsWindow.closed) {
          vmsWindow.close();
        }
      },
    });
  }

  getResidentProfilePic(callRecord: any){
    return `${environment.apiUrl}/web/image/fs.residential.family/${callRecord.family_id}/image_profile`
  }

  public rggState: any = 'standby'
  changeState(state: any) {
    this.rggState = state
    this.refreshIncomingCall()
    console.log('this.rggStatestandbystandbystandby', this.rggState)
    this.sendLogToBackend(state)
  }

  private sendLogToBackend(state: string) {
    const apiUrl = `${environment.apiUrl}/rgg/create-status-log`;
    const payload: any = {
      status: state,
      user_id: this.userId || null,
      latitude: 0,
      longitude: 0,
    };

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          payload.latitude = position.coords.latitude;
          payload.longitude = position.coords.longitude;
          this.http.post<any>(apiUrl, payload).subscribe({
            next: (res) => console.log('Status log created successfully:', res),
            error: (err) => console.error('Error creating status log:', err),
          });
        },
        (error) => {
          console.warn('Geolocation unavailable or denied, creating log without coordinates:', error);
          this.http.post<any>(apiUrl, payload).subscribe({
            next: (res) => console.log('Status log created successfully:', res),
            error: (err) => console.error('Error creating status log:', err),
          });
        },
        { timeout: 5000 }
      );
    } else {
      this.http.post<any>(apiUrl, payload).subscribe({
        next: (res) => console.log('Status log created successfully:', res),
        error: (err) => console.error('Error creating status log:', err),
      });
    }
  }

  audioPath = 'assets/audio/ringtone.mp3'
  startRingtone() {
    if (!this.ringtoneAudio) {
      this.ringtoneAudio = new Audio(this.audioPath); // adjust path
      console.log(this.ringtoneAudio)
      console.log(this.ringtoneAudio)
      this.ringtoneAudio.loop = true; // 🔁 loop forever
    }

    this.ringtoneAudio.currentTime = 0; // reset to start
    this.ringtoneAudio.play().catch(err => {
      console.error('Audio play failed:', err);
    });
  }

  endRingtone() {
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
    }
  }

}
