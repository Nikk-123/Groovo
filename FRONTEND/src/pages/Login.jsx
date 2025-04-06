import { useState } from "react";
import axios from "axios";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [flashMessage, setFlashMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFlashMessage(null);

    try {
      const response = await axios.post("/login", formData, {
        headers: { Accept: "application/json" },
      });

      const data = response.data;
      if (data.success) {
        if (data.library) {
          localStorage.setItem("userLibrary", JSON.stringify(data.library));
        }
        window.location.href = data.redirect;
      } else {
        setFlashMessage({ type: "danger", text: data.message || "Login failed." });
      }
    } catch (error) {
      setFlashMessage({ type: "danger", text: "Login failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-[#1DB954] to-[#191414] text-white">
      <header className="w-full text-center py-6 border-b border-white/10">
        <a href="/" className="text-2xl font-bold">
          <i className="fab fa-spotify"></i> Gareeb ka Spotify
        </a>
      </header>

      {flashMessage && (
        <div className="w-full max-w-md mt-4 px-4">
          <div
            className={`flash ${
              flashMessage.type === "danger" ? "bg-[#e91429]" : "bg-[#1DB954]"
            } text-white text-center py-3 rounded mb-4`}
          >
            {flashMessage.text}
          </div>
        </div>
      )}

      <div className="bg-black rounded-lg shadow-lg w-full max-w-md mx-auto p-10 my-10">
        <h1 className="text-2xl font-bold text-center mb-6">Log in to continue</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="email" className="block mb-2 font-semibold text-sm">
              Email address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full p-3 bg-[#282828] border border-white/10 rounded text-white focus:outline-none focus:border-[#1DB954]"
              placeholder="Enter your email"
            />
          </div>
          <div className="mb-5">
            <label htmlFor="password" className="block mb-2 font-semibold text-sm">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full p-3 bg-[#282828] border border-white/10 rounded text-white focus:outline-none focus:border-[#1DB954]"
              placeholder="Password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1DB954] hover:bg-[#1ed760] rounded-full font-bold transition-all"
          >
            {loading ? "Logging in..." : "LOG IN"}
          </button>
        </form>

        <div className="my-6 relative text-center text-sm">
          <div className="before:absolute before:top-1/2 before:left-0 before:w-2/5 before:h-px before:bg-white/10 after:absolute after:top-1/2 after:right-0 after:w-2/5 after:h-px after:bg-white/10">
            <span className="relative z-10 bg-black px-3">or</span>
          </div>
        </div>

        <div className="text-center border-t border-white/10 pt-6">
          <p className="mb-2 text-sm">Don't have an account?</p>
          <a href="/signup" className="text-[#1DB954] hover:text-[#1ed760] font-semibold text-sm">
            SIGN UP FOR GAREEB KA SPOTIFY
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
