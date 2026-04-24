import { useState, useEffect, useRef } from 'react';

export function useLocalStorage(key, initialValue) {
  // État initial
  const [value, setValue] = useState(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // VERROU : useRef pour bloquer l'écriture pendant la lecture
  const isInitialized = useRef(false);

  // 1. LECTURE INITIALE : Une seule fois au montage
  useEffect(() => {
    console.log(`Début lecture ${key}...`);
    
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          const parsedValue = JSON.parse(item);
          console.log(`Mémoire lue : ${parsedValue} pour ${key}`);
          setValue(parsedValue);
        } else {
          console.log(`Mémoire lue : ${initialValue} (valeur par défaut) pour ${key}`);
          setValue(initialValue);
        }
      } catch (error) {
        console.error("Erreur lecture:", error);
        setValue(initialValue);
      }
    }
    
    // VERROU DÉVERROUILLÉ : La lecture est terminée
    isInitialized.current = true;
    setIsLoaded(true);
    console.log(`Lecture terminée pour ${key} - Écriture autorisée`);
  }, [key, initialValue]);

  // 2. SAUVEGARDE : BLOQUÉE si pas initialisé
  useEffect(() => {
    // BLOCAGE CRITIQUE : Si la lecture n'est pas finie, on n'écrit JAMAIS
    if (!isInitialized.current) {
      console.log(`Sauvegarde bloquée car non initialisé pour ${key}: ${value}`);
      return;
    }

    // Si initialisé, on peut sauvegarder
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      console.log(`Sauvegarde effectuée : ${value} pour ${key}`);
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
    }
  }, [key, value]);

  return [value, setValue, isLoaded];
}
