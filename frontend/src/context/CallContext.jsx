import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Peer from 'peerjs';

const CallContext = createContext(null);
export const useCall = () => useContext(CallContext);

const SIGNALING_URL = window.location.origin;

export const CallProvider = ({ children }) => {
    const socketRef = useRef(null);
    const peerRef = useRef(null);           // PeerJS instance
    const localStreamRef = useRef(null);
    const audioElRef = useRef(null);        // Native audio element for remote voice
    const activeCallRef = useRef(null);     // Active PeerJS MediaConnection

    const [myNumber, setMyNumber] = useState(null);
    const [friends, setFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);

    const [callState, setCallState] = useState('idle');
    const [activeCallContact, setActiveCallContact] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    const [localVideoEnabled, setLocalVideoEnabled] = useState(false);
    const [localAudioEnabled, setLocalAudioEnabled] = useState(true);

    // ─── Media Capture ──────────────────────────────────────────────────────────
    const getLocalStream = async (video = false) => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
            localStreamRef.current = stream;
            return stream;
        } catch (e) {
            alert('Mic/Camera access denied: ' + e.message);
            return null;
        }
    };

    // ─── PeerJS Initialization ───────────────────────────────────────────────────
    const initPeer = (id) => {
        if (peerRef.current) return;

        console.log('[PeerJS] Initializing with ID:', id);
        // Use default PeerJS cloud servers
        const peer = new Peer(id, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (peerID) => {
            console.log('[PeerJS] Connection open. ID:', peerID);
        });

        peer.on('call', (call) => {
            console.log('[PeerJS] Incoming call from:', call.peer);
            setIncomingCall({ fromNumber: call.peer, call });
            setCallState('ringing');
        });

        peer.on('error', (err) => {
            console.error('[PeerJS] Error:', err.type, err);
            if (err.type === 'peer-unavailable') {
                alert('Contact is offline or ID is invalid.');
                endCall();
            }
        });

        peerRef.current = peer;
    };

    // ─── Call Actions ────────────────────────────────────────────────────────────
    const startCall = async (targetNumber) => {
        console.log('[Call] Calling:', targetNumber);
        const stream = await getLocalStream(false);
        if (!stream) return;

        setActiveCallContact(targetNumber);
        setCallState('calling');

        // Initiate PeerJS call
        const call = peerRef.current.call(targetNumber, stream);
        activeCallRef.current = call;

        setupCallListeners(call);
    };

    const acceptCall = async () => {
        if (!incomingCall) return;
        const { fromNumber, call } = incomingCall;
        console.log('[Call] Accepting call from:', fromNumber);

        const stream = await getLocalStream(false);
        if (!stream) return;

        setActiveCallContact(fromNumber);
        setCallState('active');
        setIncomingCall(null);

        call.answer(stream);
        activeCallRef.current = call;
        setupCallListeners(call);
    };

    const setupCallListeners = (call) => {
        call.on('stream', (remoteStream) => {
            console.log('[Call] Received remote stream');
            setRemoteStream(remoteStream);
            setCallState('active');

            if (audioElRef.current) {
                audioElRef.current.srcObject = remoteStream;
                audioElRef.current.play().catch(e => console.warn('[Audio] play failed:', e));
            }
        });

        call.on('close', () => {
            console.log('[Call] Remote connection closed');
            endCall();
        });

        call.on('error', (err) => {
            console.error('[Call] MediaConnection error:', err);
            endCall();
        });
    };

    const rejectCall = () => {
        if (!incomingCall) return;
        incomingCall.call.close();
        setIncomingCall(null);
        setCallState('idle');
    };

    const endCall = useCallback(() => {
        console.log('[Call] Ending session');
        activeCallRef.current?.close();
        activeCallRef.current = null;

        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;

        if (audioElRef.current) {
            audioElRef.current.srcObject = null;
        }

        setRemoteStream(null);
        setCallState('idle');
        setActiveCallContact(null);
        setIncomingCall(null);
    }, []);

    const toggleAudio = () => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setLocalAudioEnabled(track.enabled);
            }
        }
    };

    const toggleVideo = async () => {
        // PeerJS makes renegotiation tricky, so we toggle track enabled for now
        if (localStreamRef.current) {
            const track = localStreamRef.current.getVideoTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setLocalVideoEnabled(track.enabled);
            } else {
                // Try to upgrade to video if allowed
                try {
                    const vs = await navigator.mediaDevices.getUserMedia({ video: true });
                    const vt = vs.getVideoTracks()[0];
                    localStreamRef.current.addTrack(vt);
                    // Replace track in all outgoing senders if possible
                    activeCallRef.current?.peerConnection.getSenders().forEach(s => {
                        if (s.track?.kind === 'video') s.replaceTrack(vt);
                    });
                    setLocalVideoEnabled(true);
                } catch (e) { console.error('[Video] upgrade failed', e); }
            }
        }
    };

    const inviteToCall = (n) => startCall(n);

    // ─── Socket & Lifecycle ────────────────────────────────────────────────────────
    useEffect(() => {
        const saved = localStorage.getItem('friends');
        if (saved) try { setFriends(JSON.parse(saved)); } catch { }

        const socket = io(SIGNALING_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.emit('register', localStorage.getItem('myNumber') || undefined);

        socket.on('registered', ({ number }) => {
            setMyNumber(number);
            localStorage.setItem('myNumber', number);
            initPeer(number);
        });

        // Backend only handles social features, PeerJS handles calling
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

        return () => {
            socket.disconnect();
            peerRef.current?.destroy();
        };
    }, []);

    // ─── Social ───
    const sendFriendRequest = (n) => socketRef.current?.emit('friend_request', { targetNumber: n });
    const acceptFriendRequest = (n) => {
        socketRef.current?.emit('friend_request_accepted', { targetNumber: n });
        setFriendRequests(prev => prev.filter(x => x !== n));
        setFriends(prev => {
            if (prev.find(f => f.number === n)) return prev;
            const next = [...prev, { number: n, name: `Contact ${n.slice(-4)}` }];
            localStorage.setItem('friends', JSON.stringify(next));
            return next;
        });
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

    const remoteStreams = activeCallContact && remoteStream ? { [activeCallContact]: remoteStream } : {};

    return (
        <CallContext.Provider value={{
            myNumber, friends, friendRequests,
            callState, activeCallContact, incomingCall,
            localVideoEnabled, localAudioEnabled,
            remoteStream, remoteStreams, localStreamRef,
            sendFriendRequest, acceptFriendRequest, declineFriendRequest, updateFriendName,
            startCall, acceptCall, rejectCall, endCall, toggleVideo, toggleAudio, inviteToCall,
        }}>
            {children}
            <audio ref={audioElRef} autoPlay playsInline style={{ display: 'none' }} />
        </CallContext.Provider>
    );
};
