'use client'
import { useState, useEffect } from 'react'

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      const alreadyInstalled = localStorage.getItem('novae_pwa_installed')
      if (!alreadyInstalled) {
        setTimeout(() => setShowPrompt(true), 3000)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Détection iOS
  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone
    if (isIOS && !isInStandaloneMode) {
      const alreadyShown = localStorage.getItem('novae_ios_prompt')
      if (!alreadyShown) {
        setTimeout(() => setShowIOSPrompt(true), 3000)
      }
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') localStorage.setItem('novae_pwa_installed', 'true')
    setShowPrompt(false)
    setDeferredPrompt(null)
  }

  const handleIOSPrompt = () => {
    localStorage.setItem('novae_ios_prompt', 'true')
    setShowIOSPrompt(false)
  }

  if (!showPrompt && !showIOSPrompt) return null

  return (
    <div style={{
      position:'fixed',bottom:80,left:16,right:16,zIndex:999,
      background:'#1C1A18',border:'1px solid rgba(196,149,106,0.3)',
      borderRadius:20,padding:'20px 20px 16px',
      boxShadow:'0 8px 40px rgba(0,0,0,0.5)',
      display:'flex',gap:14,alignItems:'flex-start',
      fontFamily:"'DM Sans', sans-serif",
    }}>
      <img src="/novae-icon.svg" alt="NOVAÉ" style={{width:48,height:48,borderRadius:12,flexShrink:0}} />
      <div style={{flex:1}}>
        <p style={{margin:'0 0 4px',fontSize:14,fontWeight:700,color:'#fff'}}>
          {showIOSPrompt ? 'Ajoute NOVAÉ à ton écran d\'accueil' : 'Installe NOVAÉ sur ton téléphone'}
        </p>
        <p style={{margin:'0 0 14px',fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.5}}>
          {showIOSPrompt 
            ? 'Appuie sur le bouton Partager puis "Sur l\'écran d\'accueil" pour ajouter l\'app.'
            : 'Accès rapide depuis ton écran d\'accueil, notifications et mode hors-ligne.'
          }
        </p>
        <div style={{display:'flex',gap:8}}>
          {showIOSPrompt ? (
            <button onClick={handleIOSPrompt} style={{
              flex:1,padding:'10px 0',borderRadius:10,border:'none',
              background:'#C4956A',color:'#fff',
              fontSize:13,fontWeight:600,cursor:'pointer',
              fontFamily:"'DM Sans', sans-serif",
            }}>✦ J'ai compris</button>
          ) : (
            <button onClick={handleInstall} style={{
              flex:1,padding:'10px 0',borderRadius:10,border:'none',
              background:'#C4956A',color:'#fff',
              fontSize:13,fontWeight:600,cursor:'pointer',
              fontFamily:"'DM Sans', sans-serif",
            }}>✦ Installer l'app</button>
          )}
          <button onClick={() => {
            if (showIOSPrompt) {
              setShowIOSPrompt(false)
            } else {
              setShowPrompt(false)
            }
          }} style={{
            padding:'10px 14px',borderRadius:10,
            border:'1px solid rgba(255,255,255,0.1)',
            background:'transparent',color:'rgba(255,255,255,0.4)',
            fontSize:13,cursor:'pointer',
            fontFamily:"'DM Sans', sans-serif",
          }}>Plus tard</button>
        </div>
      </div>
      <button onClick={() => {
        if (showIOSPrompt) {
          setShowIOSPrompt(false)
        } else {
          setShowPrompt(false)
        }
      }} style={{
        background:'none',border:'none',color:'rgba(255,255,255,0.3)',
        fontSize:18,cursor:'pointer',flexShrink:0,padding:0,
      }}>×</button>
    </div>
  )
}