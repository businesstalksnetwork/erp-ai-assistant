
# Plan: Improve Password Recovery UX with Rate Limit Handling

## Overview

Add a 60-second countdown timer and clear error message to the password recovery form to handle Supabase's email rate limiting gracefully.

## Changes to `src/pages/Auth.tsx`

### 1. Add New State Variables

Add state for tracking password reset cooldown:

```typescript
const [lastResetTime, setLastResetTime] = useState<number>(0);
const [resetCountdown, setResetCountdown] = useState<number>(0);
```

### 2. Add Countdown Timer Effect

Add a `useEffect` that decrements the countdown every second when active:

```typescript
useEffect(() => {
  if (resetCountdown <= 0) return;
  
  const timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - lastResetTime) / 1000);
    const remaining = Math.max(0, 60 - elapsed);
    setResetCountdown(remaining);
  }, 1000);
  
  return () => clearInterval(timer);
}, [resetCountdown, lastResetTime]);
```

### 3. Update `handleForgotPassword` Function

Modify the function to:
- Check if user is within cooldown period before making request
- Detect "rate limit exceeded" error from Supabase
- Start the 60-second countdown on both success and rate limit error
- Show a clear Serbian message about waiting

```typescript
const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  
  // Check if already in cooldown
  if (resetCountdown > 0) {
    toast({
      title: 'Molimo sačekajte',
      description: `Možete zatražiti novi link za ${resetCountdown} sekundi.`,
      variant: 'destructive',
    });
    return;
  }
  
  // ... existing validation ...
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {...});
  
  if (error) {
    // Handle rate limit error specifically
    if (error.message.toLowerCase().includes('rate limit')) {
      setLastResetTime(Date.now());
      setResetCountdown(60);
      toast({
        title: 'Previše zahteva',
        description: 'Molimo sačekajte 60 sekundi pre nego što ponovo zatražite reset lozinke.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Greška',
        description: error.message,
        variant: 'destructive',
      });
    }
  } else {
    // Success - start cooldown
    setLastResetTime(Date.now());
    setResetCountdown(60);
    toast({...});
    setMode('default');
  }
  
  setLoading(false);
};
```

### 4. Update Submit Button UI

Modify the button in the forgot-password form to show countdown and disable during cooldown:

```tsx
<Button 
  type="submit" 
  className="w-full" 
  disabled={loading || resetCountdown > 0}
>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {resetCountdown > 0 
    ? `Sačekajte ${resetCountdown}s` 
    : 'Pošalji link'
  }
</Button>
```

## User Experience After Changes

1. User clicks "Pošalji link" - email sent successfully
2. Button shows countdown: "Sačekajte 58s", "Sačekajte 57s", etc.
3. If user somehow triggers rate limit, friendly Serbian message appears
4. After 60 seconds, button becomes active again

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Add countdown state, timer effect, update handler, update button |
