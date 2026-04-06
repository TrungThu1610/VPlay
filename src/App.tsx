/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Search, User, Tv, Calendar, Home, Play, Pause, Radio, Info, Sun, Moon, Maximize, Settings } from "lucide-react";
import Hls from "hls.js";
import logo from "./logo.svg";
import { motion, AnimatePresence } from "motion/react";

import { channels } from "./channels";

const tabs = [
  { name: "Trang chủ", icon: Home },
  { name: "Truyền hình", icon: Tv },
  { name: "Phát thanh", icon: Radio },
  { name: "Thông tin", icon: Info },
];

function HomeContent({ setActiveTab, setActiveChannel, isDark }: {
  setActiveTab: (tab: string) => void,
  setActiveChannel: (ch: typeof channels[0]) => void,
  isDark: boolean
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = [
    "https://picsum.photos/seed/slide1/800/400",
    "https://picsum.photos/seed/slide2/800/400",
    "https://picsum.photos/seed/slide3/800/400"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Slider */}
      <div className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden">
        {slides.map((img, i) => (
          <img key={i} src={img} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${i === slideIndex ? "opacity-100" : "opacity-0"}`} />
        ))}
      </div>

      {/* Suggested Channels */}
      <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-950"}`}>Kênh đề xuất</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {channels.slice(0, 6).map(ch => (
          <button key={`${ch.name}-${ch.stream}`} onClick={() => { setActiveChannel(ch); setActiveTab("Truyền hình"); }} className={`p-4 rounded-xl flex items-center justify-center transition-colors ${isDark ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-100 hover:bg-slate-200"}`}>
            <img src={ch.logo} className="w-8 h-8 object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}

function TVContent({ active, setActive, isDark }: { active: typeof channels[0], setActive: (ch: typeof channels[0]) => void, isDark: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [levels, setLevels] = useState<Hls.Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
        video.play().catch(e => console.error("Autoplay prevented", e));
        setLevels(hls!.levels);
        setCurrentLevel(hls!.currentLevel);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(data.level);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = active.stream;
      video.addEventListener('loadedmetadata', () => {
        video.play();
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

  const setQuality = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setShowQualityMenu(false);
    }
  };

  const categories = Array.from(new Set(channels.map(c => c.category)));

  const toggleFullscreen = () => {
    const container = videoRef.current?.parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
      {/* VIDEO PLAYER */}
      <div className={`aspect-video bg-black rounded-2xl mb-6 flex items-center justify-center border shadow-2xl relative overflow-hidden group ${isDark ? "border-slate-800" : "border-slate-300"}`}>
        <video
          ref={videoRef}
          className="w-full h-full"
          autoPlay
          muted
          onClick={togglePlay}
        />
        {/* Modern Control Bar */}
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between">
          <button onClick={togglePlay} className="text-white hover:text-blue-400 transition-colors">
            {isPlaying ? <Pause className="h-8 w-8 fill-white" /> : <Play className="h-8 w-8 fill-white" />}
          </button>
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

      {/* CHANNEL INFO */}
      <h2 className={`text-2xl font-bold flex items-center gap-3 ${isDark ? "text-white" : "text-slate-950"}`}>
        {active.name}
        <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
          TRỰC TIẾP
        </span>
      </h2>
      <p className={`${isDark ? "text-slate-400" : "text-slate-600"} mt-1`}>Tên chương trình hiện tại</p>

      {/* CHANNEL LIST */}
      <div className="mt-8 space-y-8">
        {categories.map(cat => (
          <div key={cat}>
            <h3 className={`mb-4 text-lg font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{cat}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {channels.filter(c => c.category === cat).map((ch) => (
                <button
                  key={`${ch.name}-${ch.stream}`}
                  onClick={() => {
                    setActive(ch);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`p-4 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 border ${
                    active.name === ch.name
                      ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20"
                      : isDark
                      ? "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain rounded-xl" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Truyền hình");
  const [activeChannel, setActiveChannel] = useState(channels[0]);
  const [isDark, setIsDark] = useState(true);

  return (
    <div className={`${isDark ? "bg-slate-950 text-white" : "bg-white text-slate-950"} min-h-screen flex flex-col transition-colors duration-300`}>
      
      {/* HEADER */}
      <header className={`flex items-center justify-between p-4 backdrop-blur-md sticky top-0 z-50 border-b ${isDark ? "bg-slate-900/80 border-slate-800" : "bg-slate-100/80 border-slate-300"}`}>
        <img src={logo} alt="VPlay Logo" className="h-10 w-auto" />
        <div className="relative flex-1 max-w-md mx-4">
          <Search className={`absolute left-2 top-2.5 h-4 w-4 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
          <input
            placeholder="Tìm kiếm..."
            className={`w-full pl-9 pr-3 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full ${isDark ? "bg-slate-800 text-yellow-400" : "bg-slate-200 text-slate-700"}`}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-300"}`}>
            <User className={`h-5 w-5 ${isDark ? "text-slate-300" : "text-slate-600"}`} />
          </div>
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
            {activeTab === "Truyền hình" && <TVContent active={activeChannel} setActive={setActiveChannel} isDark={isDark} />}
            {activeTab !== "Trang chủ" && activeTab !== "Truyền hình" && (
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
