/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, ChangeEvent } from "react";
import { Search, User, Tv, Calendar, Home, Play, Pause, Radio, Info, Sun, Moon, Maximize, Settings, Volume2, VolumeX, CheckCircle2, Shield, LogOut, LogIn } from "lucide-react";
import Hls from "hls.js";
import { motion, AnimatePresence } from "motion/react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";

import { channels } from "./channels";

const baseTabs = [
  { name: "Trang chủ", icon: Home },
  { name: "Truyền hình", icon: Tv },
  { name: "Phát thanh", icon: Radio },
  { name: "Thông tin", icon: Info },
];

function ChannelLogo({ src, alt, className, isDark }: { src: string, alt: string, className?: string, isDark: boolean }) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-slate-800/50 rounded-lg border border-slate-700/50 p-1 text-center`}>
        <Tv className="h-6 w-6 mb-1 text-slate-500" />
        <span className="text-[10px] font-bold leading-tight line-clamp-2 uppercase opacity-60">{alt}</span>
      </div>
    );
  }

  const needsScale = ["Cần Thơ 1 HD", "Cần Thơ 2 HD", "Cần Thơ 3 HD", "DRT HD", "THĐT1 HD", "NTV", "H1", "H2"].includes(alt);
  const scaleClass = needsScale ? "scale-150" : "";

  return (
    <img 
      src={src} 
      alt={alt} 
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className={`${className} object-contain transition-all duration-300 ${!isDark ? "drop-shadow-[0_16px_32px_rgba(0,0,0,0.3)]" : ""} ${scaleClass}`} 
    />
  );
}

function HomeContent({ setActiveTab, setActiveChannel, isDark }: {
  setActiveTab: (tab: string) => void,
  setActiveChannel: (ch: typeof channels[0]) => void,
  isDark: boolean
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [randomChannels, setRandomChannels] = useState<typeof channels>([]);
  const slides = [
    "https://plain-apac-prod-public.komododecks.com/202604/06/0rdrbV8FYCssv6LnT4aJ/image.png",
    "https://plain-apac-prod-public.komododecks.com/202604/06/DN6JPkubjkRfKgJlYYIa/image.png"
  ];

  useEffect(() => {
    const shuffled = [...channels].sort(() => 0.5 - Math.random());
    setRandomChannels(shuffled.slice(0, 6));

    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Slider */}
      <div className="relative w-full max-w-4xl mx-auto aspect-[2/1] rounded-2xl overflow-hidden shadow-xl">
        {slides.map((img, i) => (
          <img key={i} src={img} referrerPolicy="no-referrer" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === slideIndex ? "opacity-100" : "opacity-0"}`} />
        ))}
      </div>

      {/* Suggested Channels */}
      <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-950"}`}>Kênh đề xuất</h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        {randomChannels.map(ch => (
          <button key={`${ch.name}-${ch.stream}`} onClick={() => { setActiveChannel(ch); setActiveTab("Truyền hình"); }} className={`p-2 rounded-xl flex items-center justify-center transition-all hover:scale-105 backdrop-blur-xl border ${isDark ? "bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 shadow-sm shadow-black/20" : "bg-white/40 border-white/60 hover:bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"}`}>
            <ChannelLogo src={ch.logo} alt={ch.name} className="w-16 h-16 md:w-20 md:h-20" isDark={isDark} />
          </button>
        ))}
      </div>
    </div>
  );
}

function TVContent({ active, setActive, isDark, searchQuery, setSearchQuery }: { 
  active: typeof channels[0], 
  setActive: (ch: typeof channels[0]) => void, 
  isDark: boolean,
  searchQuery: string,
  setSearchQuery: (q: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [levels, setLevels] = useState<Hls.Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;

    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(active.stream);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => {
          console.warn("Autoplay prevented, trying muted", e);
          video.muted = true;
          setIsMuted(true);
          video.play();
        });
        setLevels(hls!.levels);
        setCurrentLevel(hls!.currentLevel);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(data.level);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = active.stream;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play();
        });
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [active]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      } else if (val === 0 && !isMuted) {
        videoRef.current.muted = true;
        setIsMuted(true);
      }
    }
  };

  const setQuality = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setShowQualityMenu(false);
    }
  };

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const filteredChannels = channels.filter(ch => 
    ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = Array.from(new Set(filteredChannels.map(c => c.category)));

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
      {/* VIDEO PLAYER */}
      <div className={`aspect-video bg-black rounded-2xl mb-6 flex items-center justify-center border shadow-2xl relative overflow-hidden group ${isDark ? "border-slate-800" : "border-slate-300"}`}>
        <video
          ref={videoRef}
          className="w-full h-full"
          autoPlay
          muted={isMuted}
          onClick={togglePlay}
        />
        {/* Tap to Unmute Overlay */}
        {isMuted && isPlaying && (
          <button 
            onClick={toggleMute}
            className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-black/80 transition-all animate-bounce"
          >
            <VolumeX className="h-4 w-4" />
            CHẠM ĐỂ BẬT TIẾNG
          </button>
        )}
        {/* Modern Control Bar */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-blue-400 transition-colors">
              {isPlaying ? <Pause className="h-8 w-8 fill-white" /> : <Play className="h-8 w-8 fill-white" />}
            </button>
            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="text-white hover:text-blue-400 transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={isMuted ? 0 : volume} 
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={toggleFullscreen} className="text-white hover:text-blue-400 transition-colors">
              <Maximize className="h-6 w-6" />
            </button>
            <div className="relative">
              <button onClick={() => setShowQualityMenu(!showQualityMenu)} className="text-white hover:text-blue-400 transition-colors">
                <Settings className="h-6 w-6" />
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-10 right-0 bg-slate-900/90 backdrop-blur-md rounded-lg p-2 text-sm text-white border border-slate-700 w-32">
                  <button onClick={() => setQuality(-1)} className={`block w-full text-left px-4 py-2 hover:bg-slate-700 rounded ${currentLevel === -1 ? "text-blue-400" : ""}`}>Auto</button>
                  {levels.map((level, index) => (
                    <button key={index} onClick={() => setQuality(index)} className={`block w-full text-left px-4 py-2 hover:bg-slate-700 rounded ${currentLevel === index ? "text-blue-400" : ""}`}>
                      {level.height}p
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHANNEL INFO & SEARCH */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className={`text-2xl font-bold flex items-center gap-3 ${isDark ? "text-white" : "text-slate-950"}`}>
          {active.name}
          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
            TRỰC TIẾP
          </span>
        </h2>
        
        <div className="relative w-full md:w-64">
          <Search className={`absolute left-3 top-2.5 h-4 w-4 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
          <input
            type="text"
            placeholder="Tìm kênh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"} border`}
          />
        </div>
      </div>

      {/* CHANNEL LIST */}
      <div className="mt-8 space-y-8">
        {categories.map(cat => (
          <div key={cat}>
            <h3 className={`mb-4 text-lg font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{cat}</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {filteredChannels.filter(c => c.category === cat).map((ch) => (
                <button
                  key={`${ch.name}-${ch.stream}`}
                  onClick={() => {
                    setActive(ch);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`p-2 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 border backdrop-blur-xl ${
                    active.name === ch.name
                      ? "bg-blue-500/80 border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-105"
                      : isDark
                      ? "bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/50 shadow-sm shadow-black/20 hover:scale-105"
                      : "bg-white/40 border-white/60 hover:bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:scale-105"
                  }`}
                >
                  <ChannelLogo src={ch.logo} alt={ch.name} className="w-full h-full" isDark={isDark} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminContent({ isDark }: { isDark: boolean }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        const usersData = snapshot.docs.map(doc => doc.data());
        setUsers(usersData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  if (loading) return <div className="p-8 text-center">Đang tải...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Lỗi: {error}</div>;

  const filteredUsers = users.filter(u => u.email !== "nguyentrungthu1610@gmail.com");

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h2 className={`text-2xl font-bold mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>Quản lý người dùng</h2>
      <div className={`rounded-xl border overflow-x-auto ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"}`}>
        <table className="w-full text-left min-w-[600px]">
          <thead className={`border-b ${isDark ? "border-slate-800 bg-slate-800/50 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            <tr>
              <th className="p-4 font-medium">Người dùng</th>
              <th className="p-4 font-medium">Ngày tạo</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? "divide-slate-800 text-slate-300" : "divide-slate-200 text-slate-700"}`}>
            {filteredUsers.map(u => (
              <tr key={u.uid}>
                <td className="p-4 flex items-center gap-3">
                  {u.photoURL ? <img src={u.photoURL} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center"><User className="w-4 h-4 text-slate-600" /></div>}
                  {u.displayName || "Chưa có tên"}
                </td>
                <td className="p-4">{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : ""}</td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={2} className="p-4 text-center text-slate-500">Chưa có người dùng nào khác.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfileContent({ isDark, user, userData, setUserData }: { isDark: boolean, user: FirebaseUser, userData: any, setUserData: any }) {
  const [name, setName] = useState(userData?.displayName || user.displayName || "");
  const [avatar, setAvatar] = useState(userData?.photoURL || user.photoURL || "");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          setAvatar(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isDataUrl = avatar.startsWith('data:');
      const profileUpdates: any = { displayName: name };
      if (!isDataUrl) {
        profileUpdates.photoURL = avatar;
      }
      await updateProfile(user, profileUpdates);
      
      await setDoc(doc(db, "users", user.uid), {
        displayName: name,
        photoURL: avatar
      }, { merge: true });
      
      setUserData({ ...userData, displayName: name, photoURL: avatar });
      alert("Đã cập nhật hồ sơ thành công!");
    } catch (e: any) {
      console.error(e);
      alert("Lỗi cập nhật: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h2 className={`text-2xl font-bold mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>Hồ sơ của bạn</h2>
      <div className={`space-y-6 p-6 rounded-xl border ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"}`}>
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>Ảnh đại diện</label>
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {avatar ? (
                <img src={avatar} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-blue-500" referrerPolicy="no-referrer" />
              ) : (
                <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 border-dashed ${isDark ? "border-slate-600 bg-slate-800" : "border-slate-300 bg-slate-100"}`}>
                  <User className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-medium">Thay đổi</span>
              </div>
            </div>
            <div className="flex-1">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${isDark ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-700"}`}>
                Tải ảnh lên từ thiết bị
              </button>
            </div>
          </div>
        </div>
        
        <div>
          <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>Tên hiển thị</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nhập tên của bạn" className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-300 text-slate-900"}`} />
        </div>
        
        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors">
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
}

function InfoContent({ isDark }: { isDark: boolean }) {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h2 className={`text-2xl font-bold mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>Thông tin</h2>
      <div className={`space-y-6 p-6 rounded-xl border leading-relaxed ${isDark ? "border-slate-800 bg-slate-900/50 text-slate-300" : "border-slate-200 bg-white text-slate-700"}`}>
        <div className="space-y-2">
          <h3 className={`text-xl font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Vplay by OTA System</h3>
          <p>Vận hành hoạt động từ ngày 25/6/2025</p>
          <p>Chuyển sang giao diện mới từ ngày 10/4/2026</p>
        </div>

        <div className="space-y-2">
          <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Lịch sử các phiên bản:</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Phiên bản v1.0 (website cũ - 25/6/2025)</li>
            <li>Phiên bản v1.1 (website mới - 10/4/2026)</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Một số kênh đang sửa chữa:</h3>
          <p>Hải Phòng, Hải Phòng 3, Sơn La, Ninh Bình, Bắc Ninh, Hưng Yên, Khánh Hoà 1, Quảng Ngãi 2</p>
          <p className="italic">Các kênh được nêu trên sẽ được sửa chữa ở các phiên bản sau!</p>
        </div>

        <div className={`space-y-2 pt-4 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>Ủng hộ website:</h3>
          <ul className="space-y-2">
            <li><a href="https://www.youtube.com/@otaonefr253" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://www.youtube.com/@otaonefr253</a></li>
            <li><a href="https://www.youtube.com/@otatwofr253" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://www.youtube.com/@otatwofr253</a></li>
            <li><a href="https://www.youtube.com/@otathreefr253" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://www.youtube.com/@otathreefr253</a></li>
            <li><a href="https://www.youtube.com/@otafourfr253" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://www.youtube.com/@otafourfr253</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function AuthModal({ isOpen, onClose, isDark }: { isOpen: boolean, onClose: () => void, isDark: boolean }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const email = username.includes('@') ? username : `${username}@vplay.local`;
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: username.split('@')[0] });
      }
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Tên đăng nhập hoặc mật khẩu không chính xác.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Tên đăng nhập này đã được sử dụng.");
      } else if (err.code === 'auth/weak-password') {
        setError("Mật khẩu quá yếu (ít nhất 6 ký tự).");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full max-w-md p-6 rounded-2xl shadow-xl ${isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>
        <h2 className="text-2xl font-bold mb-6 text-center">{isLogin ? "Đăng nhập" : "Đăng ký"}</h2>
        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tên đăng nhập</label>
            <input required value={username} onChange={e => setUsername(e.target.value)} className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-300"}`} placeholder="Nhập tên đăng nhập..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mật khẩu</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-300"}`} placeholder="Nhập mật khẩu..." />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors">
            {loading ? "Đang xử lý..." : (isLogin ? "Đăng nhập" : "Đăng ký")}
          </button>
        </form>
        <div className="mt-4 text-center text-sm">
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-blue-500 hover:underline">
            {isLogin ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
          </button>
        </div>
        <button onClick={onClose} className="mt-6 w-full py-2 border rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200">Đóng</button>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Trang chủ");
  const [activeChannel, setActiveChannel] = useState(channels[0]);
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        let role = "user";
        if (userSnap.exists()) {
          role = userSnap.data().role;
          setUserData(userSnap.data());
        } else {
          // Check if it's the default admin
          if (currentUser.email === "nguyentrungthu1610@gmail.com") {
            role = "admin";
          }
          const newUserData: any = {
            uid: currentUser.uid,
            email: currentUser.email,
            role: role,
            createdAt: serverTimestamp()
          };
          if (currentUser.displayName) newUserData.displayName = currentUser.displayName;
          if (currentUser.photoURL) newUserData.photoURL = currentUser.photoURL;
          
          await setDoc(userRef, newUserData);
          setUserData(newUserData);
        }
        setIsAdmin(role === "admin");
      } else {
        setIsAdmin(false);
        setUserData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab("Trang chủ");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const tabs = [...baseTabs];
  if (user && !isAdmin) {
    tabs.push({ name: "Hồ sơ", icon: User });
  }
  if (isAdmin) {
    tabs.push({ name: "Quản trị", icon: Shield });
  }

  const handleHeaderSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (activeTab !== "Truyền hình" && val.trim() !== "") {
      setActiveTab("Truyền hình");
    }
  };

  return (
    <div className={`${isDark ? "bg-slate-950 text-white" : "bg-white text-slate-950"} min-h-screen flex flex-col transition-colors duration-300`}>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} isDark={isDark} />
      {/* HEADER */}
      <header className={`flex items-center justify-between p-4 backdrop-blur-md sticky top-0 z-50 border-b ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-slate-100/80 border-slate-300"}`}>
        <img src="https://plain-apac-prod-public.komododecks.com/202604/07/UVfrgsfRDLt4CYroyI1q/image.png" alt="VPlay Logo" className={`h-10 w-auto transition-all duration-300 ${!isDark ? "drop-shadow-md" : ""}`} referrerPolicy="no-referrer" />
        <div className="relative flex-1 max-w-xs mx-4">
          <Search className={`absolute left-2 top-2.5 h-4 w-4 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
          <input
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={handleHeaderSearch}
            className={`w-full pl-9 pr-3 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full ${isDark ? "bg-slate-800 text-yellow-400" : "bg-slate-200 text-slate-700"}`}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          
          {user ? (
            <div className="flex items-center gap-2">
              <img src={userData?.photoURL || user.photoURL || ""} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-300 object-cover" referrerPolicy="no-referrer" />
              <button onClick={handleLogout} className={`p-2 rounded-full ${isDark ? "bg-slate-800 text-red-400 hover:bg-slate-700" : "bg-slate-200 text-red-500 hover:bg-slate-300"}`} title="Đăng xuất">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isDark ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}`}>
              <LogIn className="h-4 w-4" />
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full"
          >
            {activeTab === "Trang chủ" && <HomeContent setActiveTab={setActiveTab} setActiveChannel={setActiveChannel} isDark={isDark} />}
            {activeTab === "Truyền hình" && (
              user ? (
                <TVContent active={activeChannel} setActive={setActiveChannel} isDark={isDark} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
              ) : (
                <div className={`flex flex-col items-center justify-center h-full gap-4 p-4 text-center ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  <Shield className="h-16 w-16 text-blue-500 mb-2 opacity-80" />
                  <h2 className="text-2xl font-bold">Yêu cầu đăng nhập</h2>
                  <p className="max-w-md">Bạn cần đăng nhập để xem các kênh truyền hình trực tuyến. Vui lòng đăng nhập hoặc tạo tài khoản để tiếp tục.</p>
                  <button onClick={handleLogin} className="mt-4 px-8 py-3 bg-blue-500 text-white rounded-full font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
                    Đăng nhập / Đăng ký
                  </button>
                </div>
              )
            )}
            {activeTab === "Phát thanh" && (
              user ? (
                <div className={`flex items-center justify-center h-full gap-2 text-lg font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  Tính năng đang phát triển
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center h-full gap-4 p-4 text-center ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  <Shield className="h-16 w-16 text-blue-500 mb-2 opacity-80" />
                  <h2 className="text-2xl font-bold">Yêu cầu đăng nhập</h2>
                  <p className="max-w-md">Bạn cần đăng nhập để nghe các kênh phát thanh. Vui lòng đăng nhập hoặc tạo tài khoản để tiếp tục.</p>
                  <button onClick={handleLogin} className="mt-4 px-8 py-3 bg-blue-500 text-white rounded-full font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
                    Đăng nhập / Đăng ký
                  </button>
                </div>
              )
            )}
            {activeTab === "Hồ sơ" && user && !isAdmin && <ProfileContent isDark={isDark} user={user} userData={userData} setUserData={setUserData} />}
            {activeTab === "Quản trị" && isAdmin && <AdminContent isDark={isDark} />}
            {activeTab === "Thông tin" && <InfoContent isDark={isDark} />}
            {activeTab !== "Trang chủ" && activeTab !== "Truyền hình" && activeTab !== "Phát thanh" && activeTab !== "Quản trị" && activeTab !== "Hồ sơ" && activeTab !== "Thông tin" && (
              <div className={`flex items-center justify-center h-full ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {activeTab} - Nội dung
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* BOTTOM NAV */}
      <nav className={`flex justify-around p-4 border-t sticky bottom-0 z-50 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-300"}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex flex-col items-center gap-1 ${
                activeTab === tab.name ? "text-blue-500" : isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs">{tab.name}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
