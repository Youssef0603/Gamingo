#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <AppTrackingTransparency/AppTrackingTransparency.h>
#import <React/RCTBridgeModule.h>

@interface AppTrackingTransparencyModule : NSObject <RCTBridgeModule>
@end

@implementation AppTrackingTransparencyModule {
  NSMutableArray<RCTPromiseResolveBlock> *_pendingResolvers;
  BOOL _isRequestingAuthorization;
  id _didBecomeActiveObserver;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _pendingResolvers = [NSMutableArray new];
  }
  return self;
}

- (void)dealloc
{
  [self removeDidBecomeActiveObserver];
}

RCT_REMAP_METHOD(getTrackingAuthorizationStatus,
                 getTrackingAuthorizationStatusWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve([self currentAuthorizationStatusString]);
}

RCT_REMAP_METHOD(requestTrackingAuthorization,
                 requestTrackingAuthorizationWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  if (![self isTrackingAuthorizationAvailable]) {
    resolve(@"unavailable");
    return;
  }

  ATTrackingManagerAuthorizationStatus status = ATTrackingManager.trackingAuthorizationStatus;
  if (status != ATTrackingManagerAuthorizationStatusNotDetermined) {
    resolve([self stringFromAuthorizationStatus:status]);
    return;
  }

  [_pendingResolvers addObject:[resolve copy]];

  if (_isRequestingAuthorization) {
    return;
  }

  _isRequestingAuthorization = YES;
  [self requestTrackingAuthorizationWhenApplicationIsActive];
}

- (BOOL)isTrackingAuthorizationAvailable
{
  if (@available(iOS 14.5, *)) {
    return YES;
  }

  return NO;
}

- (NSString *)currentAuthorizationStatusString
{
  if (![self isTrackingAuthorizationAvailable]) {
    return @"unavailable";
  }

  return [self stringFromAuthorizationStatus:ATTrackingManager.trackingAuthorizationStatus];
}

- (NSString *)stringFromAuthorizationStatus:(ATTrackingManagerAuthorizationStatus)status
{
  switch (status) {
    case ATTrackingManagerAuthorizationStatusAuthorized:
      return @"authorized";
    case ATTrackingManagerAuthorizationStatusDenied:
      return @"denied";
    case ATTrackingManagerAuthorizationStatusRestricted:
      return @"restricted";
    case ATTrackingManagerAuthorizationStatusNotDetermined:
      return @"not_determined";
  }

  return @"unknown";
}

- (void)requestTrackingAuthorizationWhenApplicationIsActive
{
  if (UIApplication.sharedApplication.applicationState == UIApplicationStateActive) {
    [self presentTrackingAuthorizationRequest];
    return;
  }

  if (_didBecomeActiveObserver) {
    return;
  }

  __weak AppTrackingTransparencyModule *weakSelf = self;
  _didBecomeActiveObserver = [[NSNotificationCenter defaultCenter]
      addObserverForName:UIApplicationDidBecomeActiveNotification
                  object:nil
                   queue:[NSOperationQueue mainQueue]
              usingBlock:^(__unused NSNotification *notification) {
                AppTrackingTransparencyModule *strongSelf = weakSelf;
                [strongSelf removeDidBecomeActiveObserver];
                [strongSelf presentTrackingAuthorizationRequest];
              }];
}

- (void)presentTrackingAuthorizationRequest
{
  if (![self isTrackingAuthorizationAvailable]) {
    [self completePendingResolversWithStatusString:@"unavailable"];
    return;
  }

  ATTrackingManagerAuthorizationStatus currentStatus = ATTrackingManager.trackingAuthorizationStatus;
  if (currentStatus != ATTrackingManagerAuthorizationStatusNotDetermined) {
    [self completePendingResolversWithStatusString:[self stringFromAuthorizationStatus:currentStatus]];
    return;
  }

  [ATTrackingManager requestTrackingAuthorizationWithCompletionHandler:^(
                         ATTrackingManagerAuthorizationStatus status) {
    dispatch_async(dispatch_get_main_queue(), ^{
      [self completePendingResolversWithStatusString:[self stringFromAuthorizationStatus:status]];
    });
  }];
}

- (void)completePendingResolversWithStatusString:(NSString *)status
{
  NSArray<RCTPromiseResolveBlock> *resolvers = [_pendingResolvers copy];
  [_pendingResolvers removeAllObjects];
  _isRequestingAuthorization = NO;

  for (RCTPromiseResolveBlock resolver in resolvers) {
    resolver(status);
  }
}

- (void)removeDidBecomeActiveObserver
{
  if (!_didBecomeActiveObserver) {
    return;
  }

  [[NSNotificationCenter defaultCenter] removeObserver:_didBecomeActiveObserver];
  _didBecomeActiveObserver = nil;
}

@end
