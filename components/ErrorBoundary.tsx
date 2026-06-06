
import React from "react";
import { Button, ScrollView, Text, View } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-[#f5f5f5] p-4 pt-12">
          <ScrollView className="flex-1">
            <Text className="text-[24px] font-bold mb-4 text-[#333]">
              Oops! Something went wrong
            </Text>

            <View className="bg-[#fff] rounded-[8px] p-3 mb-4 border-l-[4px] border-l-[#ff3b30]">
              <Text className="text-[14px] font-semibold text-[#ff3b30] mb-2">
                {this.state.error?.message}
              </Text>

              {this.state.errorInfo && (
                <Text className="text-[11px] text-[#555] font-mono leading-[16px]">
                  {this.state.errorInfo.componentStack}
                </Text>
              )}

              {this.state.error?.stack && (
                <Text className="text-[11px] text-[#555] font-mono leading-[16px]">
                  {this.state.error.stack}
                </Text>
              )}
            </View>

            <Text className="text-[14px] text-[#666] leading-[20px] mb-5">
              This error has been reported to our monitoring system. We&pos;ll
              investigate and fix it as soon as possible.
            </Text>
          </ScrollView>

          <View className="p-4 bg-[#fff] border-t border-[#ddd]">
            <Button
              title="Try again"
              onPress={this.handleReload}
              color="#007AFF"
            />
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
