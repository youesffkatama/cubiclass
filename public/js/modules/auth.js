import { AppState } from "./state.js";
import { API } from "./api.js";
import { Utils } from "./ui.js";
import { NavigationModule } from "./navigation.js";

export const AuthModule = {
  init: async () => {
    console.log("🚀 AuthModule initializing...");

    if (document.readyState === "loading") {
      await new Promise((resolve) =>
        document.addEventListener("DOMContentLoaded", resolve),
      );
    }

    const splash = document.getElementById("splashScreen");
    const loginContainer = document.getElementById("loginContainer");
    const signupContainer = document.getElementById("signupContainer");
    const appLayer = document.getElementById("appLayer");

    AuthModule.bindEvents();

    setTimeout(async () => {
      try {
        const token = Utils.loadFromStorage("scholar_token");

        if (token) {
          console.log("🔍 Verifying session...");
          const response = await API.get("/auth/me");
          AppState.user = response.data.user;

          AuthModule.loadApp();
        } else {
          throw new Error("No session");
        }
      } catch {
        console.log("ℹ️ Showing login screen");
        localStorage.removeItem("scholar_token");
        localStorage.removeItem("currentUser");
        AppState.user = null;

        if (appLayer) appLayer.style.display = "none";
        if (signupContainer) signupContainer.style.display = "none";
        if (loginContainer) {
          loginContainer.style.display = "flex";
          loginContainer.classList.add("show");
        }
      } finally {
        if (splash) {
          splash.style.opacity = "0";
          setTimeout(() => (splash.style.display = "none"), 500);
        }
      }
    }, 1500);
  },

  bindEvents: () => {
    const authContainer = document.body;

    authContainer.addEventListener("submit", (e) => {
      if (e.target.id === "loginForm") {
        e.preventDefault();
        AuthModule.handleLogin(e);
      } else if (e.target.id === "signupForm") {
        e.preventDefault();
        AuthModule.handleSignup(e);
      }
    });

    authContainer.addEventListener("click", (e) => {
      const goToSignup = e.target.closest("#goToSignup");
      const goToLogin = e.target.closest("#goToLogin");

      if (goToSignup) {
        e.preventDefault();
        document.getElementById("loginContainer").style.display = "none";
        document.getElementById("signupContainer").style.display = "flex";
      }

      if (goToLogin) {
        e.preventDefault();
        document.getElementById("signupContainer").style.display = "none";
        document.getElementById("loginContainer").style.display = "flex";
      }
    });
  },

  handleLogin: async () => {
    try {
      const email = document.getElementById("loginEmail")?.value?.trim();
      const password = document.getElementById("loginPassword")?.value;

      if (!email || !password) {
        Utils.showToast("Please enter email and password", "error");
        return;
      }

      const btn = document.querySelector('#loginForm button[type="submit"]');
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
      btn.disabled = true;

      const data = await API.post("/auth/login", { email, password });

      await Utils.saveToStorage("scholar_token", data.data.tokens.accessToken);
      await Utils.saveToStorage("currentUser", JSON.stringify(data.data.user));
      AppState.user = data.data.user;

      Utils.showToast("Welcome back!", "success");

      document.getElementById("loginContainer").style.display = "none";
      AuthModule.loadApp();
    } catch (error) {
      Utils.showToast(error.message || "Login failed", "error");
      const btn = document.querySelector('#loginForm button[type="submit"]');
      if (btn) {
        btn.innerHTML =
          '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
        btn.disabled = false;
      }
    }
  },

  handleSignup: async () => {
    try {
      const firstName = document
        .getElementById("signupFirstName")
        ?.value?.trim();
      const lastName = document.getElementById("signupLastName")?.value?.trim();
      const email = document.getElementById("signupEmail")?.value?.trim();
      const password = document.getElementById("signupPassword")?.value;
      const education = document.getElementById("signupEducation")?.value;

      if (!firstName || !lastName || !email || !password || !education) {
        Utils.showToast("Please fill in all fields", "error");
        return;
      }

      if (password.length < 8) {
        Utils.showToast("Password must be at least 8 characters", "error");
        return;
      }

      const btn = document.querySelector('#signupForm button[type="submit"]');
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
      btn.disabled = true;

      const requestBody = {
        username: `${firstName.toLowerCase()}${Math.floor(Math.random() * 10000)}`,
        email: email,
        password: password,
        profile: { firstName, lastName },
        educationLevel: education,
      };

      const data = await API.post("/auth/register", requestBody);

      await Utils.saveToStorage("scholar_token", data.data.tokens.accessToken);
      await Utils.saveToStorage("currentUser", JSON.stringify(data.data.user));
      AppState.user = data.data.user;

      Utils.showToast("Account created!", "success");

      document.getElementById("signupContainer").style.display = "none";
      AuthModule.loadApp();
    } catch (error) {
      Utils.showToast(error.message || "Signup failed", "error");
      const btn = document.querySelector('#signupForm button[type="submit"]');
      if (btn) {
        btn.innerHTML =
          '<span>Create Account</span><i class="fas fa-arrow-right"></i>';
        btn.disabled = false;
      }
    }
  },

  loadApp: () => {
    const loginContainer = document.getElementById("loginContainer");
    const signupContainer = document.getElementById("signupContainer");
    const appLayer = document.getElementById("appLayer");

    if (loginContainer) loginContainer.style.display = "none";
    if (signupContainer) signupContainer.style.display = "none";
    if (appLayer) appLayer.style.display = "flex";

    NavigationModule.init();

    const userName = document.getElementById("userName");
    const avatarImg = document.querySelector(".user-profile img");

    if (userName) userName.textContent = AppState.user.username || "Student";
    if (avatarImg) {
      avatarImg.src =
        AppState.user.profile?.avatar ||
        `https://ui-avatars.com/api/?name=${AppState.user.username}&background=00ed64&color=001e2b`;
    }

    NavigationModule.navigateTo("dashboard");
  },

  logout: () => {
    Utils.showToast("Logging out...", "info");
    setTimeout(() => {
      localStorage.clear();
      window.location.reload();
    }, 1000);
  },
};
