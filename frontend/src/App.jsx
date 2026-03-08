import { CallProvider, useCall } from './context/CallContext';
import Onboarding from './components/Onboarding';
import AppLayout from './components/AppLayout';
import ActiveCall from './components/ActiveCall';
import { Phone } from 'lucide-react';
import './index.css';

// Full-screen ringing overlay — appears on top of everything on mobile & desktop
function RingingOverlay() {
  const { callState, incomingCall, acceptCall, rejectCall } = useCall();

  if (callState !== 'ringing' || !incomingCall) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '2rem',
    }}>
      {/* Pulsing ring animation */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '3px solid #fff', animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite',
          opacity: 0.4,
        }} />
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: '#111', border: '2px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '3rem',
        }}>📞</div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#888', fontSize: '0.9rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Incoming Call
        </p>
        <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '4px', margin: 0 }}>
          {incomingCall.fromNumber?.match(/.{1,4}/g)?.join('-')}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: '3rem', marginTop: '1rem' }}>
        <button
          onClick={rejectCall}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#ff3b30', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(255,59,48,0.5)',
          }}
        >
          <Phone size={28} color="#fff" style={{ transform: 'rotate(135deg)' }} />
        </button>
        <button
          onClick={acceptCall}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#34c759', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(52,199,89,0.5)',
          }}
        >
          <Phone size={28} color="#fff" />
        </button>
      </div>
      <div style={{ display: 'flex', gap: '4rem', marginTop: '-1rem' }}>
        <span style={{ color: '#888', fontSize: '0.75rem', letterSpacing: '1px' }}>DECLINE</span>
        <span style={{ color: '#888', fontSize: '0.75rem', letterSpacing: '1px' }}>ACCEPT</span>
      </div>
    </div>
  );
}

// Full-screen calling overlay (shown to the person who initiated the call)
function CallingOverlay() {
  const { callState, activeCallContact, endCall } = useCall();
  if (callState !== 'calling') return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '2rem',
    }}>
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        background: '#111', border: '2px solid #333',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '3rem',
      }}>📡</div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#888', fontSize: '0.9rem', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Calling...
        </p>
        <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '4px', margin: 0 }}>
          {activeCallContact?.match(/.{1,4}/g)?.join('-') || activeCallContact}
        </h2>
      </div>

      <button
        onClick={endCall}
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: '#ff3b30', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px rgba(255,59,48,0.5)', marginTop: '1rem',
        }}
      >
        <Phone size={28} color="#fff" style={{ transform: 'rotate(135deg)' }} />
      </button>
      <span style={{ color: '#888', fontSize: '0.75rem', letterSpacing: '1px' }}>END CALL</span>
    </div>
  );
}

function MainApp() {
  const { myNumber } = useCall();
  const hasSeenOnboarding = localStorage.getItem('myNumber') !== null;

  if (!myNumber || !hasSeenOnboarding) {
    return <Onboarding />;
  }

  return (
    <>
      <AppLayout />
      <ActiveCall />
      <RingingOverlay />
      <CallingOverlay />
    </>
  );
}

function App() {
  return (
    <CallProvider>
      <MainApp />
    </CallProvider>
  );
}

export default App;
