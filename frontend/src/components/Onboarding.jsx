import { useState } from 'react';
import { useCall } from '../context/CallContext';

export default function Onboarding() {
    const { myNumber } = useCall();
    const [permissionGranted, setPermissionGranted] = useState(false);

    if (!myNumber) {
        return (
            <div className="onboarding-container animate-fade-in" style={styles.container}>
                <h1 style={{ letterSpacing: '-2px' }}>Welcome.</h1>
                <p style={{ color: '#666', fontSize: '1.2rem' }}>Connecting to the grid...</p>
            </div>
        );
    }

    const handleStart = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setPermissionGranted(true);
            navigator.clipboard.writeText(myNumber);
            setClicked(true);
            setTimeout(() => setClicked(false), 2000);
        } catch (err) {
            console.error('Mic permission denied', err);
            alert('Microphone access is required for calls.');
        }
    };

    return (
        <div className="onboarding-container animate-fade-in" style={styles.container}>
            <div style={styles.content}>
                <h1 style={styles.title}>Your Identity</h1>
                <p style={styles.subtitle}>Microphone access is required. Click below to grant access and copy your ID.</p>

                <div
                    style={{ ...styles.numberBox, borderColor: permissionGranted ? '#34c759' : '#333' }}
                    onClick={handleStart}
                >
                    <span style={styles.number}>{myNumber.match(/.{1,4}/g)?.join('-')}</span>
                    <span style={{ ...styles.copyText, color: permissionGranted ? '#34c759' : '#666' }}>
                        {clicked ? 'Authorized & Copied!' : 'Authorize Mic & Copy ID'}
                    </span>
                </div>

                <p style={styles.footer}>Welcome to the void. The system is ready.</p>
            </div>
        </div>
    );
}

const styles = {
    container: {
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: '#fff',
        padding: '2rem'
    },
    content: {
        maxWidth: '500px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem'
    },
    title: {
        fontSize: '3.5rem',
        fontWeight: '700',
        marginBottom: '0.5rem',
        letterSpacing: '-0.05em'
    },
    subtitle: {
        color: '#888',
        fontSize: '1.1rem'
    },
    numberBox: {
        background: '#111',
        border: '1px solid #333',
        padding: '2rem 3rem',
        borderRadius: '24px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
    },
    number: {
        fontSize: '2.5rem',
        fontWeight: '600',
        letterSpacing: '0.05em',
        color: '#fff'
    },
    copyText: {
        color: '#666',
        fontSize: '0.9rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em'
    },
    footer: {
        color: '#444',
        fontSize: '0.9rem',
        marginTop: '2rem'
    }
};
