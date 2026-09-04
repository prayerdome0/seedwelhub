import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUser, friendlyAuthError, sendVerificationEmail as firebaseSendVerification, syncProfile } from '../firebase/auth';
import { ensureUserDocument } from '../services/userService';
import { uploadImageToCloudinary } from '../cloudinary/upload';
import { useToast } from '../contexts/ToastContext';
import { COUNTRY_OPTIONS } from '../utils/countries';
import Avatar from '../components/Avatar';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setError('Please choose an image file for your profile photo.');
      return;
    }
    try {
      const result = await uploadImageToCloudinary(file);
      setPhotoUrl(result.secureUrl);
      setPhoto(file);
    } catch (err) {
      setError(err.message || 'Photo upload failed. Please try again.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!country.trim()) {
      setError('Please select your country.');
      return;
    }
    if (password.length < 6) {
      setError('Your password must be at least 6 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create the Firebase Auth account.
      const cred = await createUser(email.trim(), password);
      const uid = cred.user.uid;

      // 2. Create the Firestore user document (role defaults to "user" — a
      //    normal user can never choose their own role).
      await ensureUserDocument(uid, {
        email: email.trim(),
        name,
        photoURL: photoUrl,
        country,
        phone: phone.trim(),
      });

      // 3. Sync display name / photo onto the Auth profile.
      await syncProfile({ displayName: name, photoURL: photoUrl || null }).catch(() => {});

      // 4. Send verification email.
      await firebaseSendVerification().catch(() => {});

      showToast('Account created! Please check your email to verify.', 'success');
      navigate('/verify-email');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-card__title">Create your account</h1>
      <p className="auth-card__subtitle">Join Seedwel Hub to buy, sell, manage and grow.</p>

      {error && <div className="form__msg form__msg--error">{error}</div>}

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__group">
          <label className="form__label">Profile photo (optional)</label>
          <div className="flex items-center gap-16">
            <Avatar src={photoUrl} name={name} size="lg" />
            <label className="btn btn--secondary btn--sm">
              Choose photo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            </label>
          </div>
        </div>

        <div className="form__group">
          <label className="form__label" htmlFor="reg-name">Full name</label>
          <input
            id="reg-name"
            type="text"
            className="form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            autoComplete="name"
          />
        </div>
        <div className="form__group">
          <label className="form__label" htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            className="form__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="form__group">
          <label className="form__label" htmlFor="reg-country">Country</label>
          <select
            id="reg-country"
            className="form__input form__select"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            autoComplete="country-name"
          >
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="form__group">
          <label className="form__label" htmlFor="reg-phone">Phone (optional)</label>
          <input
            id="reg-phone"
            type="tel"
            className="form__input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+256 700 000 000"
            autoComplete="tel"
          />
        </div>
        <div className="form__row">
          <div className="form__group">
            <label className="form__label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              className="form__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="reg-confirm">Confirm password</label>
            <input
              id="reg-confirm"
              type="password"
              className="form__input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <div className="auth-card__alt">
        Already have an account? <Link to="/login">Log in</Link>
      </div>
    </div>
  );
}
