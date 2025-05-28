"use client";
import React, { useState, useEffect } from 'react';
import { Menu, X, Github, ArrowRight, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Zap, Users, Lock, Palette, Download, Globe, Sparkles, Layers, Star, Twitter, Linkedin, Mail } from 'lucide-react';

// Button Component
const Button: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
  className?: string;
  onClick?: () => void;
}> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  onClick,
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    outline: 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500',
  };
  
  const sizeStyles = 'px-4 py-2 text-sm';
  const widthStyles = fullWidth ? 'w-full' : '';
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles} ${widthStyles} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

// Header Component
const Header: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 w-full z-50 transition-all duration-200 ${
        isScrolled ? 'bg-white shadow-sm py-2' : 'bg-transparent py-4'
      }`}
    >
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center">
          <a href="/" className="text-2xl font-bold text-gray-800 flex items-center">
            Excalidraw
          </a>
        </div>

        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
          <a href="#showcase" className="text-gray-600 hover:text-gray-900">Showcase</a>
          <a href="#testimonials" className="text-gray-600 hover:text-gray-900">Testimonials</a>
          <a href="https://github.com/excalidraw/excalidraw" className="text-gray-600 hover:text-gray-900 flex items-center">
            <Github size={18} className="mr-1" />
            GitHub
          </a>
          <Button variant="primary">Open App</Button>
        </nav>

        <button 
          className="md:hidden text-gray-700"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white w-full py-4 px-4 shadow-lg">
          <nav className="flex flex-col space-y-4">
            <a href="#features" className="text-gray-600 hover:text-gray-900 py-2">Features</a>
            <a href="#showcase" className="text-gray-600 hover:text-gray-900 py-2">Showcase</a>
            <a href="#testimonials" className="text-gray-600 hover:text-gray-900 py-2">Testimonials</a>
            <a href="https://github.com/excalidraw/excalidraw" className="text-gray-600 hover:text-gray-900 py-2 flex items-center">
              <Github size={18} className="mr-1" />
              GitHub
            </a>
            <Button variant="primary" fullWidth>Open App</Button>
          </nav>
        </div>
      )}
    </header>
  );
};

// Hero Component
const Hero: React.FC = () => {
  return (
    <section className="pt-20 md:pt-24 lg:pt-32 pb-16 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center">
          <div className="w-full lg:w-1/2 lg:pr-12 mb-10 lg:mb-0">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
              Draw Together,{' '}
              <span className="text-blue-600">Think Better</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Excalidraw is a virtual whiteboard for sketching hand-drawn like diagrams. 
              Collaborate with others in real-time, or share your drawings with the world.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button variant="primary" className="px-6 py-3 text-base">
                Start Drawing Now
              </Button>
              <Button variant="outline" className="px-6 py-3 text-base group">
                <span>Explore Examples</span>
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
          <div className="w-full lg:w-1/2 relative">
            <div className="relative rounded-lg overflow-hidden shadow-xl border border-gray-200">
              <div className="bg-gray-50 h-8 flex items-center px-4 border-b border-gray-200">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
              </div>
              <img 
                src="https://images.pexels.com/photos/7014337/pexels-photo-7014337.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
                alt="Excalidraw Interface" 
                className="w-full"
              />
            </div>
            <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-blue-100 rounded-full -z-10"></div>
            <div className="absolute -top-8 -left-8 w-40 h-40 bg-yellow-100 rounded-full -z-10"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Features Component
const Features: React.FC = () => {
  const features = [
    {
      icon: <Zap size={24} />,
      title: 'Fast & Simple',
      description: 'Quick to load and easy to use. No complicated tools or steep learning curves.',
    },
    {
      icon: <Users size={24} />,
      title: 'Real-time Collaboration',
      description: 'Work together with your team in real-time, no matter where they are.',
    },
    {
      icon: <Lock size={24} />,
      title: 'End-to-End Encryption',
      description: 'Your data is secure with end-to-end encryption for all your drawings.',
    },
    {
      icon: <Palette size={24} />,
      title: 'Customizable',
      description: 'Personalize your diagrams with custom colors, fills, and line styles.',
    },
    {
      icon: <Download size={24} />,
      title: 'Export Options',
      description: 'Export your drawings as PNG, SVG, or in our collaborative file format.',
    },
    {
      icon: <Globe size={24} />,
      title: 'Open Source',
      description: 'Built with transparency. Contribute to our growing community on GitHub.',
    },
    {
      icon: <Sparkles size={24} />,
      title: 'Libraries & Templates',
      description: 'Access libraries of shapes and templates to speed up your workflow.',
    },
    {
      icon: <Layers size={24} />,
      title: 'Multiple Boards',
      description: 'Create and manage multiple drawings within the same workspace.',
    },
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features, Simple Interface
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to create beautiful, collaborative diagrams without the complexity.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="p-6 rounded-lg transition-all duration-300 hover:bg-gray-50 hover:shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Showcase Component
const Showcase: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const showcaseItems = [
    {
      id: 1,
      title: 'System Architecture',
      description: 'Create clear system architecture diagrams with our intuitive tools.',
      image: 'https://images.pexels.com/photos/7014965/pexels-photo-7014965.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
      id: 2,
      title: 'Workflow Diagrams',
      description: 'Map out complex workflows and processes with ease.',
      image: 'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
    {
      id: 3,
      title: 'Mind Maps',
      description: 'Organize your thoughts with collaborative mind mapping.',
      image: 'https://images.pexels.com/photos/8867433/pexels-photo-8867433.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    },
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === showcaseItems.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? showcaseItems.length - 1 : prev - 1));
  };

  return (
    <section id="showcase" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            See What You Can Create
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From simple sketches to complex diagrams, Excalidraw makes it easy to visualize your ideas.
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="overflow-hidden rounded-xl shadow-lg">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {showcaseItems.map((item) => (
                <div key={item.id} className="w-full flex-shrink-0">
                  <div className="relative">
                    <img 
                      src={item.image} 
                      alt={item.title} 
                      className="w-full h-[500px] object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-8 text-white">
                      <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
                      <p className="text-white/80">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-gray-800 shadow-md z-10"
            onClick={prevSlide}
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-gray-800 shadow-md z-10"
            onClick={nextSlide}
          >
            <ChevronRight size={24} />
          </button>

          <div className="flex justify-center mt-6 space-x-2">
            {showcaseItems.map((_, index) => (
              <button
                key={index}
                className={`w-3 h-3 rounded-full ${
                  currentSlide === index ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// Testimonials Component
const Testimonials: React.FC = () => {
  const testimonials = [
    {
      content: "Excalidraw has completely transformed how our team collaborates on system designs. It's intuitive, fast, and the hand-drawn style adds a personal touch to our diagrams.",
      author: "Sarah Johnson",
      role: "Product Manager at TechCorp",
      avatar: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
      rating: 5,
    },
    {
      content: "As a software engineer, I've tried many diagramming tools, but Excalidraw strikes the perfect balance between simplicity and functionality. It's now our go-to tool for all technical discussions.",
      author: "Michael Chen",
      role: "Senior Developer at StartupX",
      avatar: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
      rating: 5,
    },
    {
      content: "The real-time collaboration feature is a game-changer for remote teams. We use Excalidraw daily for our design sprints and brainstorming sessions.",
      author: "Emily Rodriguez",
      role: "UX Designer at DesignHub",
      avatar: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
      rating: 4,
    },
  ];

  return (
    <section id="testimonials" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Loved by Teams Everywhere
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See what our users are saying about their experience with Excalidraw.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 transition-all duration-300 hover:shadow-md">
              <div className="flex space-x-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    className={i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-6 italic">{testimonial.content}</p>
              <div className="flex items-center">
                <img src={testimonial.avatar} alt={testimonial.author} className="w-12 h-12 rounded-full mr-4" />
                <div>
                  <h4 className="font-medium text-gray-900">{testimonial.author}</h4>
                  <p className="text-gray-600 text-sm">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// FAQ Component
const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  
  const faqs = [
    {
      question: "Is Excalidraw free to use?",
      answer: "Yes, Excalidraw is free and open source. You can use it for personal or commercial projects without any cost. We also offer Excalidraw+, a premium version with additional features for teams and businesses."
    },
    {
      question: "Can I collaborate with others in real-time?",
      answer: "Absolutely! Real-time collaboration is one of our core features. Simply share your drawing link with others, and they can join your session instantly. Changes are synced in real-time across all participants."
    },
    {
      question: "Is my data secure when using Excalidraw?",
      answer: "We take data security seriously. All your drawings are end-to-end encrypted, meaning only you and those you share with can access them. We don't store your drawings on our servers unless you explicitly save them."
    },
    {
      question: "Can I export my drawings?",
      answer: "Yes, you can export your drawings in various formats including PNG, SVG, and our native .excalidraw format. This makes it easy to include your diagrams in documents, presentations, or websites."
    },
    {
      question: "Does Excalidraw work offline?",
      answer: "Yes, Excalidraw works offline as a Progressive Web App (PWA). You can install it on your device and use it without an internet connection. Your work will be saved locally."
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Find answers to common questions about Excalidraw.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-6 md:p-8">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-gray-200 py-5">
              <button
                className="flex justify-between items-center w-full text-left"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <h3 className="text-lg font-medium text-gray-900">{faq.question}</h3>
                <span className="ml-6 flex-shrink-0">
                  {openIndex === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </span>
              </button>
              {openIndex === index && (
                <div className="mt-3 pr-12">
                  <p className="text-base text-gray-600">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// CTA Section Component
const CTASection: React.FC = () => {
  return (
    <section className="py-20 bg-blue-600 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Ready to Start Creating?
        </h2>
        <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-8">
          Join millions of users who trust Excalidraw for their diagramming needs.
          No sign-up required to get started.
        </p>
        <Button 
          variant="secondary" 
          className="px-8 py-3 text-base font-medium shadow-lg hover:shadow-xl transition-all"
        >
          Launch Excalidraw
        </Button>
        <p className="mt-6 text-blue-200">
          Free forever. Open source. No login required.
        </p>
      </div>
    </section>
  );
};

// Footer Component
const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <a href="/" className="text-2xl font-bold flex items-center mb-4">
              Excalidraw
            </a>
            <p className="text-gray-400 mb-4">
              A virtual whiteboard for sketching hand-drawn like diagrams.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Github size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Linkedin size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <Mail size={20} />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Download</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Updates</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Tutorials</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Community</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Legal</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} Excalidraw. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex space-x-6">
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy Policy</a>
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Terms of Service</a>
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

function App() {
  useEffect(() => {
    document.title = 'Excalidraw - Virtual whiteboard for sketching';
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        //@ts-ignore
        const href = this.getAttribute('href');
        if (href) {
          const targetElement = document.querySelector(href);
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: 'smooth'
            });
          }
        }
      });
    });
    
    return () => {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.removeEventListener('click', () => {});
      });
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main>
        <Hero />
        <Features />
        <Showcase />
        <Testimonials />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default App;