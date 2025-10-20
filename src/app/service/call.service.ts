import { Injectable, OnDestroy } from '@angular/core';
import { map, Observable, BehaviorSubject, catchError, of } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

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
  private temporaryOffer: any;

  audioStatus = new BehaviorSubject<string>('');
  callActionStatus = new BehaviorSubject<string>('');
  private incomingCallListSubject = new BehaviorSubject<any[]>([]);
  incomingCallList$ = this.incomingCallListSubject.asObservable();
  private missedCallListSubject = new BehaviorSubject<any[]>([]);
  missedCallList$ = this.missedCallListSubject.asObservable();
  private ongoingCallRecordSubject = new BehaviorSubject<any>(null);
  ongoingCallRecord$ = this.ongoingCallRecordSubject.asObservable()

  constructor(
    private route: ActivatedRoute,
    protected http: HttpClient,
  ) {
    this.initializeSocket();
  }

  async initializeSocket() {
    try{
      if (this.initialized) return;
      this.initialized = true;
      const params = this.route.snapshot.queryParams;
      this.userId = parseInt(params['user_id'], 0);
      this.userName = `Command Center - ${parseInt(params['user_id'], 0)}`;
    
      this.socket = io('http://192.168.1.109:8091', {
        query: { uniqueId: params['user_id'] ? `RGG-${params['user_id']}` : 'Public-user' },
      });
      this.refreshCallLog();

      this.socket.on('offer', (offer: any) => this.handleOffer(offer));
      this.socket.on('answer', (answer: any) => this.handleAnswer(answer));
      this.socket.on('ice-candidate', (candidate: any) => this.handleICECandidate(candidate));
      this.socket.on('end-call', () => this.handleEndCall());
      this.socket.on('reject-call', () => this.handleRejectCall());
      this.socket.on('user-not-found', (data: any) => this.handleUserNotFound(data));
      this.socket.on('receiver-info', (data: any) => this.handleReceiverInfo(data));
      this.socket.on('receiver-pending-call', (data: any) => this.handleReceiverPendingCall(data));
      this.socket.on('sender-pending-call', (data: any) => this.handleSenderPendingCall(data));
      this.socket.on('open-modal-call', (data: any) => this.handleOngoingCallModal());
      this.socket.on('refresh-incoming-call', (data: any) => this.refreshCallLog());
    } catch (error) {
      console.error('Error during socket initialization:', error);
    }
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

  private async resetCallData() {
    try {
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
      this.pendingCandidates = [];
      this.callerpendingCandidates = [];
      this.remoteDescriptionSet = false;
      this.callActionStatus.next('');
      this.ongoingCallRecordSubject.next(null);

      localStorage.removeItem('callData');
    } catch (error) {
      console.error('Error during clearCallData:', error);
    }
  }

  async startLocalStream(): Promise<boolean> {
    try {
      // 1. Cek apakah MediaDevices API tersedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API or getUserMedia not available');
        return false;
      }

      // 2. iOS-specific constraints - lebih konservatif
      const constraints = {
        video: true,
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
    if (videoElement) {
      videoElement.srcObject = this.localStream;
      await videoElement.play();
      videoElement.muted = true;
    }
    const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
    if (remoteVideo) {
      remoteVideo.srcObject = this.remoteStream;
      await remoteVideo.play();
    }
  }

  async createOffer(receiverPhone: any = false, receiverId: any = false, unit_id: any = false, isResident: any = false) {
    if (!receiverId && !receiverPhone && !unit_id) {
      return;
    }

    await this.startLocalStream();

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
      this.remoteStream = event.streams[0];
      const remoteVideo: HTMLVideoElement = document.getElementById('remote-video') as HTMLVideoElement;
      remoteVideo.srcObject = this.remoteStream;
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

  async handleAnswer(answer: any) {
    // await this.stopOutgoingRingtone();
    // await this.stopRingtone();
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
    // End previous ongoing call if exist
    // await this.endCallRecord(this.ongoingCallRecord$);

    this.ongoingCallRecordSubject.next(callRecord);
    console.log("======data");
    console.log(this.ongoingCallRecord$)
    this.callerName = callRecord.caller_name;
    const offer = callRecord.offer_obj;
    this.callerSocketId = callRecord.caller_socket_id;
    this.receiverSocketId = callRecord.receiver_socket_id;
    this.targetSocketIds = callRecord.target_socket_ids;

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

    this.updateCallRecordState(callRecord.id, 'ongoing');
    // await this.stopRingtone();
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      await this.peerConnection.addIceCandidate(candidate);
    }

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    this.startRecordingWithWebAudio(this.localStream, this.remoteStream)

    console.log("Trying to answer hereeee --->")
    console.log(this.receiverSocketId);
    console.log(this.socket.id);
    this.receiverSocketId = this.socket.id
    console.log("Trying to answer hereeee --->")
    console.log(this.callerSocketId);

    this.socket.emit('answer', {
      answerObj: answer,
      receiverName: this.receiverName,
      callerName: this.callerName,
      callerSocketId: this.callerSocketId,
      receiverSocketId: this.receiverSocketId
    });
  }

  async acceptCall(offer: any) {
    // await this.stopRingtone();
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      await this.peerConnection.addIceCandidate(candidate);
    }

    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    this.startRecordingWithWebAudio(this.localStream, this.remoteStream)

    this.socket.emit('answer', {
      answerObj: answer,
      receiverName: this.receiverName,
      callerName: this.callerName,
      callerSocketId: this.callerSocketId,
      receiverSocketId: this.receiverSocketId
    });
  }

  async handleOngoingCallModal() {
    console.log("Trigger kash herrrrr");
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
    this.resetCallData();
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
    const localSource = audioCtx.createMediaStreamSource(localStream);
    const remoteSource = audioCtx.createMediaStreamSource(remoteStream);

    // Connect sources to destination
    localSource.connect(dest);
    remoteSource.connect(dest);

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

        const payload = {
          audio: base64Audio,
          caller_id: this.callerId,
          receiver_id: this.receiverId,
          project_id: this.project_id
        };

        // this.mainVmsService.getApi(payload, '/call/post/recorded_call').subscribe({
        //   next: (res) => console.log(res),
        //   error: (err) => console.error(err)
        // });
      };

      audioCtx.close()
      this.mediaRecorder.stop()

      // const url = URL.createObjectURL(blob);
      // const a = document.createElement('a');
      // a.style.display = 'none';
      // a.href = url;
      // a.download = 'recorded-call.webm';
      // document.body.appendChild(a);
      // a.click();
      // URL.revokeObjectURL(url);
    };

    this.mediaRecorder.start();
  }

  stopRecordingWithWebAudio() {
    console.log(this.callerId, this.receiverId)
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

  updateCallRecordState(recordId: Number, state: String){{
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
    this.socket.emit('intercom-open-gate', { intercom_id: intercom_id });
  }

  async closeGate(intercom_id: any) {
    this.socket.emit('intercom-close-gate', { intercom_id: intercom_id });
  }
}
