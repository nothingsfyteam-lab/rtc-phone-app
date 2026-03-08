import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const SIGNALING_URL = window.location.origin;

const ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
};

export const CallProvider = ({ children }) => {
    const socketRef = useRef(null);
    const pcRef = useRef(null);           // RTCPeerConnection
    const localStreamRef = useRef(null);
    const pendingCandidates = useRef([]); // ICE candidates queued before remoteDesc set
    const audioElRef = useRef(null);      // imperative Audio element for remote audio

    const [myNumber, setMyNumber] = useState(null);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);

    const [callState, setCallState] = useState('idle');
    const [activeCallContact, setActiveCallContact] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    const [localVideoEnabled, setLocalVideoEnabled] = useState(false);
    const [localAudioEnabled, setLocalAudioEnabled] = useState(true);

    // ─── Audio ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (audioElRef.current) {
            if (remoteStream) {
                console.log('[Audio] Attaching remote stream to DOM element');
                audioElRef.current.srcObject = remoteStream;
                audioElRef.current.play().catch(e => console.warn('[Audio] play() blocked by browser:', e.message));
            } else {
                audioElRef.current.srcObject = null;
            }
        }
    }, [remoteStream]);

    // ─── Media ───────────────────────────────────────────────────────────────────
    const getLocalStream = async (video = false) => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true, video });
            localStreamRef.current = s;
            return s;
        } catch (e) {
            alert('🎤 Could not access microphone: ' + e.message + '\nPlease grant microphone permission.');
            return null;
        }
    };

    // ─── PeerConnection factory ───────────────────────────────────────────────────
    const createPC = useCallback((targetNumber) => {
        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcRef.current = pc;

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
                console.log('[PC] Added local track:', track.kind);
            });
        }

        // Send ICE candidates to the other peer via signaling
        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                socketRef.current?.emit('ice_candidate', { targetNumber, candidate });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[ICE] state:', pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
            console.log('[PC] state:', pc.connectionState);
            if (pc.connectionState === 'failed') {
                console.warn('[PC] Connection failed — trying ICE restart');
                pc.restartIce();
            }
        };

        // This fires when the remote sends audio/video
        pc.ontrack = (event) => {
            console.log('[PC] ✅ Got remote track!', event.track.kind, event.streams);
            const stream = event.streams[0];
            setRemoteStream(stream);
            setCallState('active');
        };

        return pc;
    }, []);

    // ─── Drain queued ICE candidates ─────────────────────────────────────────────
    const drainCandidates = async (pc) => {
        const q = pendingCandidates.current.splice(0);
        for (const c of q) {
            try { await pc.addIceCandidate(c); }
            catch (e) { console.warn('[ICE] queued candidate failed', e.message); }
        }
    };

    // ─── Call actions ─────────────────────────────────────────────────────────────
    const startCall = async (targetNumber) => {
        console.log('[Call] Calling', targetNumber);
        const stream = await getLocalStream(false);
        if (!stream) return;

        setActiveCallContact(targetNumber);
        setCallState('calling');

        const pc = createPC(targetNumber);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current?.emit('call_offer', { targetNumber, offer });
        console.log('[Call] Offer sent');
    };

    const acceptCall = async () => {
        if (!incomingCall) return;
        const { fromNumber, offer } = incomingCall;
        console.log('[Call] Accepting from', fromNumber);

        const stream = await getLocalStream(false);
        if (!stream) return;

        setActiveCallContact(fromNumber);
        setCallState('active');
        setIncomingCall(null);

        const pc = createPC(fromNumber);

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await drainCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketRef.current?.emit('call_answer', { targetNumber: fromNumber, answer });
        console.log('[Call] Answer sent');
    };

    const rejectCall = () => {
        if (!incomingCall) return;
        socketRef.current?.emit('call_ended', { targetNumber: incomingCall.fromNumber });
        setIncomingCall(null);
        setCallState('idle');
    };

    const endCall = useCallback(() => {
        const contact = activeCallContact;
        console.log('[Call] Ending');

        if (contact) socketRef.current?.emit('call_ended', { targetNumber: contact });

        pcRef.current?.close();
        pcRef.current = null;

        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        pendingCandidates.current = [];

        setRemoteStream(null);
        setCallState('idle');
        setActiveCallContact(null);
        setLocalVideoEnabled(false);
        setIncomingCall(null);
    }, [activeCallContact]);

    // ─── Media controls ───────────────────────────────────────────────────────────
    const toggleAudio = () => {
        const t = localStreamRef.current?.getAudioTracks()[0];
        if (t) { t.enabled = !t.enabled; setLocalAudioEnabled(t.enabled); }
    };

    const toggleVideo = async () => {
        const t = localStreamRef.current?.getVideoTracks()[0];
        if (t) {
            t.enabled = !t.enabled;
            setLocalVideoEnabled(t.enabled);
        } else {
            try {
                const vs = await navigator.mediaDevices.getUserMedia({ video: true });
                const vt = vs.getVideoTracks()[0];
                localStreamRef.current?.addTrack(vt);
                const pc = pcRef.current;
                const sender = pc?.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(vt);
                else pc?.addTrack(vt, localStreamRef.current);
                setLocalVideoEnabled(true);
            } catch (e) { console.error('[Video]', e); }
        }
    };

    const inviteToCall = (n) => startCall(n);

    // ─── Socket ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        const saved = localStorage.getItem('friends');
        if (saved) try { setFriends(JSON.parse(saved)); } catch { }

        const socket = io(SIGNALING_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.emit('register', localStorage.getItem('myNumber') || undefined);

        socket.on('registered', ({ number }) => {
            setMyNumber(number);
            localStorage.setItem('myNumber', number);
        });

        socket.on('friend_request_received', ({ fromNumber }) => {
            setFriendRequests(prev => [...prev.filter(n => n !== fromNumber), fromNumber]);
        });

        socket.on('friend_request_accepted', ({ byNumber }) => {
            setFriends(prev => {
                if (prev.find(f => f.number === byNumber)) return prev;
                const next = [...prev, { number: byNumber, name: `Contact ${byNumber.slice(-4)}` }];
                localStorage.setItem('friends', JSON.stringify(next));
                return next;
            });
        });

        socket.on('call_offer', ({ fromNumber, offer }) => {
            console.log('[Socket] Incoming call from', fromNumber);
            setIncomingCall({ fromNumber, offer });
            setCallState('ringing');
        });

        socket.on('call_answer', async ({ fromNumber, answer }) => {
            console.log('[Socket] Got answer from', fromNumber);
            const pc = pcRef.current;
            if (!pc) return;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                await drainCandidates(pc);
                setCallState('active');
            } catch (e) {
                console.error('[Socket] setRemoteDescription failed', e);
            }
        });

        socket.on('ice_candidate', async ({ candidate }) => {
            const pc = pcRef.current;
            const rtcCandidate = new RTCIceCandidate(candidate);
            if (pc && pc.remoteDescription) {
                try { await pc.addIceCandidate(rtcCandidate); }
                catch (e) { console.warn('[ICE]', e.message); }
            } else {
                pendingCandidates.current.push(rtcCandidate);
            }
        });

        socket.on('call_ended', () => {
            console.log('[Socket] Remote ended call');
            pcRef.current?.close();
            pcRef.current = null;
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
            pendingCandidates.current = [];
            setRemoteStream(null);
            setCallState('idle');
            setActiveCallContact(null);
            setIncomingCall(null);
        });

        return () => socket.disconnect();
    }, []);

    // ─── Social ───────────────────────────────────────────────────────────────────
    const addFriend = (number, name) => {
        setFriends(prev => {
            if (prev.find(f => f.number === number)) return prev;
            const next = [...prev, { number, name }];
            localStorage.setItem('friends', JSON.stringify(next));
            return next;
        });
    };

    const sendFriendRequest = (n) => socketRef.current?.emit('friend_request', { targetNumber: n });
    const acceptFriendRequest = (n) => {
        socketRef.current?.emit('friend_request_accepted', { targetNumber: n });
        setFriendRequests(prev => prev.filter(x => x !== n));
        addFriend(n, `Contact ${n.slice(-4)}`);
    };
    const declineFriendRequest = (n) => {
        socketRef.current?.emit('friend_request_denied', { targetNumber: n });
        setFriendRequests(prev => prev.filter(x => x !== n));
    };
    const updateFriendName = (number, newName) => {
        setFriends(prev => {
            const next = prev.map(f => f.number === number ? { ...f, name: newName } : f);
            localStorage.setItem('friends', JSON.stringify(next));
            return next;
        });
    };

    // Legacy compat
    const remoteStreams = activeCallContact && remoteStream ? { [activeCallContact]: remoteStream } : {};
    const remoteStreamsRef = useRef({});
    useEffect(() => { remoteStreamsRef.current = remoteStreams; }, [remoteStreams]);

    return (
        <CallContext.Provider value={{
            myNumber, friends, friendRequests,
            callState, activeCallContact, incomingCall,
            localVideoEnabled, localAudioEnabled,
            remoteStream, remoteStreams, remoteStreamsRef, localStreamRef,
            sendFriendRequest, acceptFriendRequest, declineFriendRequest, updateFriendName,
            startCall, acceptCall, rejectCall, endCall, toggleVideo, toggleAudio, inviteToCall,
        }}>
            {children}
            {/* Always mount a native audio element to play the remote peer's voice reliably on mobile */}
            <audio ref={audioElRef} autoPlay playsInline style={{ display: 'none' }} />
        </CallContext.Provider>
    );
};
